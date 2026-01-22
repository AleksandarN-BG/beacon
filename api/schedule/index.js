const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const config = require("../shared/config");

module.exports = async function (context, req) {
  try {
    const connectionString = config.cosmos.connectionString;
    const databaseId = config.cosmos.database;
    const containerId = config.cosmos.containers.schedule;

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
          body: { schedule: [] }
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
        const { resources: schedule } = await container.items
          .query("SELECT * FROM c ORDER BY c.startTime ASC")
          .fetchAll();
        context.res = { status: 200, body: { schedule } };
        break;
      }

      case "POST": {
        const { name, phone, startTime, endTime } = req.body;

        if (!name || !phone || !startTime || !endTime) {
          context.res = {
            status: 400,
            body: { error: "Missing required fields: name, phone, startTime, endTime" }
          };
          return;
        }

        // Engineers can only create shifts for themselves
        if (isEngineer && !isAdmin) {
          if (name !== currentUser?.name) {
            context.res = {
              status: 403,
              body: { error: "Engineers can only manage their own schedule" }
            };
            return;
          }
        } else if (!isAdmin) {
          context.res = {
            status: 403,
            body: { error: "Only admins and engineers can create shifts" }
          };
          return;
        }

        const newShift = {
          id: uuidv4(),
          name,
          phone,
          userId: currentUser?.id,
          startTime,
          endTime,
          createdAt: new Date().toISOString()
        };

        const { resource: created } = await container.items.create(newShift);
        context.res = { status: 201, body: created };
        break;
      }

      case "DELETE": {
        const deleteId = req.query.id;
        if (!deleteId) {
          context.res = {
            status: 400,
            body: { error: "Missing shift id" }
          };
          return;
        }

        // Get the shift to check ownership
        const { resource: shift } = await container.item(deleteId, deleteId).read();

        if (!shift) {
          context.res = {
            status: 404,
            body: { error: "Shift not found" }
          };
          return;
        }

        // Engineers can only delete their own shifts
        if (isEngineer && !isAdmin) {
          if (shift.userId !== currentUser?.id && shift.name !== currentUser?.name) {
            context.res = {
              status: 403,
              body: { error: "Engineers can only delete their own shifts" }
            };
            return;
          }
        } else if (!isAdmin) {
          context.res = {
            status: 403,
            body: { error: "Only admins and engineers can delete shifts" }
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

