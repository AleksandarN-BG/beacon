const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
  try {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || "beacon";
    const containerId = process.env.COSMOS_CONTAINER_INCIDENTS || "incidents";

    // Get current user from auth header
    const header = req.headers["x-ms-client-principal"];
    let currentUser = null;
    if (header) {
      const encoded = Buffer.from(header, "base64");
      const decoded = JSON.parse(encoded.toString("utf8"));
      currentUser = {
        id: decoded.userId,
        name: decoded.userDetails,
        roles: decoded.userRoles || []
      };
    }

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
        const host = process.env.WEBSITE_HOSTNAME || req.headers['host'] || 'localhost:7071';
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
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) return;

  try {
    const client = new CosmosClient(connectionString);
    const database = client.database(process.env.COSMOS_DATABASE || "beacon");
    const containerId = process.env.COSMOS_CONTAINER_SCHEDULE || "schedule";
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
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) return;

  const client = twilio(accountSid, authToken);
  
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const callbackBaseUrl = `${protocol}://${host}`;

  await client.messages.create({
    body: `Beacon Alert [${incident.severity.toUpperCase()}]: ${incident.title}`,
    from: fromNumber,
    to: phone,
    statusCallback: `${callbackBaseUrl}/api/call-events`
  });
}

async function makeCall(phone, incident, host) {
  const twilio = require('twilio');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) return;

  const client = twilio(accountSid, authToken);
  
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const callbackBaseUrl = `${protocol}://${host}`;

  // Create a TwiML document for the call with acknowledgment
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${callbackBaseUrl}/api/voice-twiml?incidentId=${incident.id}" numDigits="1" timeout="10">
    <Say voice="Polly.Joanna-Generative">
      Critical Beacon Alert: ${incident.title}. 
      Press 1 to acknowledge this incident.
    </Say>
  </Gather>
  <Say voice="Polly.Joanna-Generative">We did not receive any input. Goodbye.</Say>
</Response>`;
  
  await client.calls.create({
    twiml: twiml,
    to: phone,
    from: fromNumber,
    statusCallback: `${callbackBaseUrl}/api/call-events`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  });
}

