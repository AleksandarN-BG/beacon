const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const config = require("../shared/config");
const auth = require("../shared/auth");
const logger = require("../shared/logger");

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

        await logger.logSystemEvent(context, 'info', `New incident reported: ${title} (${severity})`);

        // Create the incident first
        const { resource: created } = await container.items.create(newIncident);

        // Trigger alerts based on severity AFTER creating the incident
        // This runs async - we don't wait for it to complete
        triggerAlerts(context, created, currentUser).catch(err => {
          context.log.error(`Alert triggering failed: ${err.message}`);
        });

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

async function triggerAlerts(context, incident, currentUser) {
  // Get current on-call person
  const connectionString = config.cosmos.connectionString;
  if (!connectionString) {
    await logger.logSystemEvent(context, 'warn', 'Cannot trigger alerts: Database not configured');
    return;
  }

  try {
    const client = new CosmosClient(connectionString);
    const database = client.database(config.cosmos.database);
    const scheduleContainer = database.container(config.cosmos.containers.schedule);

    const now = new Date().toISOString();
    const { resources: shifts } = await scheduleContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.startTime <= @now AND c.endTime >= @now",
          parameters: [{ name: "@now", value: now }]
        })
        .fetchAll();

    if (shifts.length === 0) {
      await logger.logSystemEvent(context, 'warn', 'No one currently on-call - alerts not sent');
      return;
    }

    const onCall = shifts[0];

    // NEW 3-LEVEL SEVERITY SYSTEM:
    // Low: Just log (no alerts)
    // Medium: Send SMS via alert-sms endpoint
    // High: Send SMS + Make call via alert-call endpoint

    switch (incident.severity) {
      case "low":
        // Just log - no alerts
        await logger.logSystemEvent(context, 'info', `Low severity incident logged: ${incident.title}`);
        break;

      case "medium":
        // Send SMS only using existing alert-sms endpoint
        await logger.logSystemEvent(context, 'info', `Medium severity - sending SMS to ${onCall.name}`);
        await callAlertSMS(onCall.phone, incident.title, currentUser);
        break;

      case "high":
        // Send SMS and make call using existing endpoints
        await logger.logSystemEvent(context, 'info', `High severity - sending SMS and calling ${onCall.name}`);
        await callAlertSMS(onCall.phone, incident.title, currentUser);
        await callAlertCall(onCall.phone, incident.title, incident.id, currentUser);
        break;

      default:
        await logger.logSystemEvent(context, 'warn', `Unknown severity: ${incident.severity}`);
    }
  } catch (err) {
    await logger.logSystemEvent(context, 'error', `Failed to trigger alerts: ${err.message}`, err);
  }
}

// Helper function to call the alert-sms API internally
async function callAlertSMS(phone, service, currentUser) {
  const alertSMS = require('../alert-sms');

  // Create a mock context for the internal call
  const mockContext = {
    log: console.log,
    res: null
  };

  // Create a mock request with auth already done
  const mockReq = {
    method: 'POST',
    body: {
      phone,
      service,
      status: 'down' // We're alerting about an issue
    }
  };

  // Mock the auth so it uses our current user
  const originalGetUser = require('../shared/auth').getUser;
  require('../shared/auth').getUser = async () => currentUser;

  try {
    await alertSMS(mockContext, mockReq);
  } finally {
    // Restore original auth
    require('../shared/auth').getUser = originalGetUser;
  }
}

// Helper function to call the alert-call API internally
async function callAlertCall(phone, service, incidentId, currentUser) {
  const alertCall = require('../alert-call');

  // Create a mock context for the internal call
  const mockContext = {
    log: console.log,
    res: null
  };

  // Create a mock request with auth already done
  const mockReq = {
    method: 'POST',
    body: {
      phone,
      service,
      incidentId
    },
    headers: {}
  };

  // Mock the auth so it uses our current user
  const originalGetUser = require('../shared/auth').getUser;
  require('../shared/auth').getUser = async () => currentUser;

  try {
    await alertCall(mockContext, mockReq);
  } finally {
    // Restore original auth
    require('../shared/auth').getUser = originalGetUser;
  }
}