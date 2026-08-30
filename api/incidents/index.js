const { v4: uuidv4 } = require("uuid");
const auth = require("../shared/auth");
const cosmos = require("../shared/cosmos");
const logger = require("../shared/logger");
const notify = require("../shared/notify");
const oncall = require("../shared/oncall");

module.exports = async function (context, req) {
  try {
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

    if (!cosmos.isConfigured()) {
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

    const container = cosmos.container("incidents");

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
          archived: false,
          createdAt: new Date().toISOString(),
          acknowledgedAt: null,
          resolvedAt: null
        };

        await logger.logSystemEvent(context, 'info', `New incident reported: ${title} (${severity})`);

        // Create the incident first
        const { resource: created } = await container.items.create(newIncident);

        // Trigger alerts based on severity AFTER creating the incident
        triggerAlerts(context, created).catch(err => {
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

        // Engineers and admins can acknowledge
        if (action === "acknowledged") {
          if (!isAdmin && !isEngineer) {
            context.res = {
              status: 403,
              body: { error: "Only engineers and admins can acknowledge incidents" }
            };
            return;
          }
        }

        // Engineers and admins can resolve
        if (action === "resolved") {
          if (!isAdmin && !isEngineer) {
            context.res = {
              status: 403,
              body: { error: "Only engineers and admins can resolve incidents" }
            };
            return;
          }
        }

        // Engineers and admins can archive
        if (req.body.archived === true) {
          if (!isAdmin && !isEngineer) {
            context.res = {
              status: 403,
              body: { error: "Only engineers and admins can archive incidents" }
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

        // Look up user's actual name from database
        const usersContainer = cosmos.container("users");
        const { resources: users } = await usersContainer.items
            .query({
              query: "SELECT c.id, c.name FROM c WHERE c.id = @userId",
              parameters: [{ name: "@userId", value: currentUser.id }]
            })
            .fetchAll();

        const userName = (users.length > 0 && users[0].name) ? users[0].name : currentUser?.name;

        if (req.body.status === "acknowledged" && !existing.acknowledgedAt) {
          updated.acknowledgedAt = new Date().toISOString();
          updated.assignedTo = userName;
          updated.assignedToId = currentUser?.id;
        }

        if (req.body.status === "resolved" && !existing.resolvedAt) {
          updated.resolvedAt = new Date().toISOString();
          updated.resolvedBy = userName;
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

async function triggerAlerts(context, incident) {
  if (!cosmos.isConfigured()) {
    await logger.logSystemEvent(context, "warn", "Cannot trigger alerts: database not configured");
    return;
  }

  try {
    const engineer = await oncall.currentOnCall(context);

    if (!engineer) {
      await logger.logSystemEvent(context, "warn", "No one currently on-call - alerts not sent");
      return;
    }

    if (!engineer.phone) {
      await logger.logSystemEvent(
        context,
        "warn",
        `On-call engineer ${engineer.name} has no phone number - alerts not sent`,
      );
      return;
    }

    /*
     * Severity decides how loudly we page:
     *   low     record it only
     *   medium  text
     *   high    text and ring
     *
     * These call shared/notify directly. The previous version invoked the
     * alert-sms and alert-call HTTP handlers in-process with a synthetic
     * request, and reassigned auth.getUser to a stub for the duration to get
     * past their authentication -- mutating a module every concurrent
     * invocation on the worker shares.
     */
    const service = incident.title;

    switch (incident.severity) {
      case "low":
        await logger.logSystemEvent(context, "info", `Low severity incident logged: ${service}`);
        break;

      case "medium":
        await logger.logSystemEvent(context, "info", `Medium severity - texting ${engineer.name}`);
        await notify.sendSms(context, { to: engineer.phone, service, status: "down" });
        break;

      case "high":
        await logger.logSystemEvent(context, "info", `High severity - texting and calling ${engineer.name}`);
        await notify.sendSms(context, { to: engineer.phone, service, status: "down" });
        await notify.placeCall(context, { to: engineer.phone, service, incidentId: incident.id });
        break;

      default:
        await logger.logSystemEvent(context, "warn", `Unknown severity: ${incident.severity}`);
    }
  } catch (err) {
    await logger.logSystemEvent(context, "error", `Failed to trigger alerts: ${err.message}`, err);
  }
}
