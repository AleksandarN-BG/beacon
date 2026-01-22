const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const config = require("../shared/config");
const auth = require("../shared/auth");

module.exports = async function (context, req) {
  try {
    const connectionString = config.cosmos.connectionString;
    const databaseId = config.cosmos.database;
    const containerId = config.cosmos.containers.incidents;

    // Get current user using shared auth helper
    const currentUser = await auth.getUser(context, req);

    const isAdmin = currentUser?.roles.includes("admin") || false;
    const isEngineer = currentUser?.roles.includes("engineer") || false;

    if (!currentUser) {
      context.res = {
        status: 401,
        body: { error: "Authentication required" }
      };
      return;
    }

    if (!connectionString) {
      // Return mock data if database not configured
      if (req.method === "GET") {
        context.res = {
          status: 200,
          body: { incidents: [] }
        };
        return;
      }
      
      context.res = {
        status: 503,
        body: { error: "Database not configured. Please set COSMOS_CONNECTION_STRING in application settings." }
      };
      return;
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const method = req.method.toUpperCase();

    switch (method) {
      case "GET": {
        const { resources: incidents } = await container.items
          .query("SELECT * FROM c ORDER BY c.createdAt DESC")
          .fetchAll();
        context.res = { status: 200, body: { incidents } };
        break;
      }

      case "POST": {
        const { title, description, severity, reportedBy } = req.body;

        if (!title || !severity) {
          context.res = {
            status: 400,
            body: { error: "Missing required fields: title, severity" }
          };
          return;
        }

        const newIncident = {
          id: uuidv4(),
          title,
          description: description || "",
          severity,
          status: "open",
          reportedBy: reportedBy || currentUser?.name || "Unknown",
          reportedById: currentUser?.id,
          assignedTo: null,
          assignedToId: null,
          createdAt: new Date().toISOString(),
          acknowledgedAt: null,
          resolvedAt: null
        };

        // Trigger alerts based on severity
        const host = req.headers['host'] || config.system.hostname || 'localhost:7071';
        await triggerAlerts(context, newIncident, host);

        const { resource: created } = await container.items.create(newIncident);
        context.res = { status: 201, body: created };
        break;
      }

      case "PUT": {
        const updateId = req.query.id || req.body.id;
        if (!updateId) {
          context.res = {
            status: 400,
            body: { error: "Missing incident id" }
          };
          return;
        }

        const { resource: existing } = await container.item(updateId, updateId).read();

        // Check permissions for different actions
        const action = req.body.status;

        // Engineers can only acknowledge, not resolve or escalate
        if (action === "acknowledged") {
          if (!isAdmin && !isEngineer) {
            context.res = {
              status: 403,
              body: { error: "Only engineers and admins can acknowledge incidents" }
            };
            return;
          }
        } else if (action === "resolved") {
          // Anyone authenticated can resolve for now
        } else if (req.body.escalate) {
          if (!isAdmin) {
            context.res = {
              status: 403,
              body: { error: "Only admins can escalate incidents" }
            };
            return;
          }
        }

        const updated = {
          ...existing,
          ...req.body,
          id: updateId,
          updatedAt: new Date().toISOString()
        };

        if (req.body.status === "acknowledged" && !existing.acknowledgedAt) {
          updated.acknowledgedAt = new Date().toISOString();
          updated.assignedTo = currentUser?.name;
          updated.assignedToId = currentUser?.id;
        }

        if (req.body.status === "resolved" && !existing.resolvedAt) {
          updated.resolvedAt = new Date().toISOString();
          updated.resolvedBy = currentUser?.name;
          updated.resolvedById = currentUser?.id;
        }

        const { resource: result } = await container.item(updateId, updateId).replace(updated);
        context.res = { status: 200, body: result };
        break;
      }

      case "DELETE": {
        // Only admins can delete incidents
        if (!isAdmin) {
          context.res = {
            status: 403,
            body: { error: "Only admins can delete incidents" }
          };
          return;
        }

        const deleteId = req.query.id;
        if (!deleteId) {
          context.res = {
            status: 400,
            body: { error: "Missing incident id" }
          };
          return;
        }

        await container.item(deleteId, deleteId).delete();
        context.res = { status: 200, body: { success: true, deleted: deleteId } };
        break;
      }

      default:
        context.res = {
          status: 405,
          body: { error: "Method not allowed" }
        };
    }
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

async function triggerAlerts(context, incident, host) {
  // Get current on-call person
  const connectionString = config.cosmos.connectionString;
  if (!connectionString) return;

  try {
    const client = new CosmosClient(connectionString);
    const database = client.database(config.cosmos.database);
    const containerId = config.cosmos.containers.schedule;
    const scheduleContainer = database.container(containerId);

    const now = new Date().toISOString();
    const { resources: shifts } = await scheduleContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.startTime <= @now AND c.endTime >= @now",
        parameters: [{ name: "@now", value: now }]
      })
      .fetchAll();

    if (shifts.length === 0) {
      context.log("No one currently on-call");
      return;
    }

    const onCall = shifts[0];

    // Trigger different actions based on severity
    switch (incident.severity) {
      case "high":
        // Send SMS
        await sendSMS(onCall.phone, incident, host);
        break;
      case "critical":
        // Send SMS and make call
        await sendSMS(onCall.phone, incident, host);
        await makeCall(onCall.phone, incident, host);
        break;
      // low and medium just log
    }
  } catch (err) {
    context.log("Failed to trigger alerts:", err.message);
  }
}

async function sendSMS(phone, incident, host) {
  const twilio = require('twilio');
  const accountSid = config.twilio.accountSid;
  const authToken = config.twilio.authToken;
  const fromNumber = config.twilio.phoneNumber;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials missing for SMS");
    return;
  }

  const client = twilio(accountSid, authToken);
  
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const callbackBaseUrl = `${protocol}://${host}`;

  try {
    const message = await client.messages.create({
      body: `Beacon Alert [${incident.severity.toUpperCase()}]: ${incident.title}`,
      from: fromNumber,
      to: phone,
      statusCallback: `${callbackBaseUrl}/api/call-events`
    });
    console.log(`SMS sent: ${message.sid}`);
  } catch (err) {
    console.error(`Failed to send SMS: ${err.message}`);
  }
}

async function makeCall(phone, incident, host) {
  const twilio = require('twilio');
  const accountSid = config.twilio.accountSid;
  const authToken = config.twilio.authToken;
  const fromNumber = config.twilio.phoneNumber;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials missing for Call");
    return;
  }

  const client = twilio(accountSid, authToken);
  const VoiceResponse = twilio.twiml.VoiceResponse;
  
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const callbackBaseUrl = `${protocol}://${host}`;

  // Create a TwiML document for the call with acknowledgment
  const response = new VoiceResponse();
  const gather = response.gather({
    action: `${callbackBaseUrl}/api/voice-twiml?incidentId=${incident.id}`,
    numDigits: '1',
    timeout: 10
  });
  
  gather.say({ voice: 'Polly.Joanna-Generative' }, 
    `Critical Beacon Alert: ${incident.title}. Press 1 to acknowledge this incident.`
  );
  
  response.say({ voice: 'Polly.Joanna-Generative' }, "We did not receive any input. Goodbye.");
  
  try {
    const call = await client.calls.create({
      twiml: response.toString(),
      to: phone,
      from: fromNumber,
      statusCallback: `${callbackBaseUrl}/api/call-events`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });
    console.log(`Call initiated: ${call.sid}`);
  } catch (err) {
    console.error(`Failed to initiate call: ${err.message}`);
  }
}

