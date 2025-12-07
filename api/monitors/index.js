const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
  try {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || "beacon";
    const containerId = process.env.COSMOS_CONTAINER_MONITORS || "monitors";

    if (!connectionString) {
      context.res = {
        status: 500,
        body: { error: "Database not configured" }
      };
      return;
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const method = req.method.toUpperCase();

    switch (method) {
      case "GET": {
        // Get all monitors or single monitor by id
        const id = req.query.id;
        if (id) {
          const { resource: monitor } = await container.item(id, id).read();
          context.res = { status: 200, body: monitor };
        } else {
          const { resources: monitors } = await container.items.readAll().fetchAll();
          context.res = { status: 200, body: monitors };
        }
        break;
      }

      case "POST": {
        // Create new monitor
        const { name, url, interval, alertPhone } = req.body;
        if (!name || !url) {
          context.res = {
            status: 400,
            body: { error: "Missing required fields: name, url" }
          };
          return;
        }

        const newMonitor = {
          id: uuidv4(),
          name,
          url,
          interval: interval || 60,
          alertPhone: alertPhone || null,
          status: "unknown",
          uptime: 100,
          lastChecked: null,
          createdAt: new Date().toISOString()
        };

        const { resource: created } = await container.items.create(newMonitor);
        context.res = { status: 201, body: created };
        break;
      }

      case "PUT": {
        // Update monitor
        const updateId = req.query.id || req.body.id;
        if (!updateId) {
          context.res = {
            status: 400,
            body: { error: "Missing monitor id" }
          };
          return;
        }

        const { resource: existing } = await container.item(updateId, updateId).read();
        const updated = { ...existing, ...req.body, id: updateId };
        const { resource: result } = await container.item(updateId, updateId).replace(updated);
        context.res = { status: 200, body: result };
        break;
      }

      case "DELETE": {
        // Delete monitor
        const deleteId = req.query.id;
        if (!deleteId) {
          context.res = {
            status: 400,
            body: { error: "Missing monitor id" }
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

