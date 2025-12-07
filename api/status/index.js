const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context) {
  try {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || "beacon";
    const containerId = process.env.COSMOS_CONTAINER_MONITORS || "monitors";

    if (!connectionString) {
      // Return mock data if database not configured
      context.res = {
        status: 200,
        body: {
          monitors: [
            { id: "1", name: "API Server", url: "https://api.example.com", status: "up", uptime: 99.9 },
            { id: "2", name: "Web App", url: "https://app.example.com", status: "up", uptime: 99.7 },
            { id: "3", name: "Database", url: "https://db.example.com", status: "down", uptime: 95.2 }
          ]
        }
      };
      return;
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const { resources: monitors } = await container.items.readAll().fetchAll();

    context.res = {
      status: 200,
      body: { monitors }
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

