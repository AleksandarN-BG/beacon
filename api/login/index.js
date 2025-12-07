const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      context.res = {
        status: 400,
        body: { error: "Missing email or password" }
      };
      return;
    }

    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || "beacon";
    const containerId = process.env.COSMOS_CONTAINER_USERS || "users";

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

    // Query for user by email
    const querySpec = {
      query: "SELECT * FROM c WHERE c.email = @email",
      parameters: [{ name: "@email", value: email }]
    };

    const { resources: users } = await container.items.query(querySpec).fetchAll();

    if (users.length === 0) {
      context.res = {
        status: 401,
        body: { error: "Invalid credentials" }
      };
      return;
    }

    const user = users[0];

    // In production, use proper password hashing (bcrypt)
    if (user.password !== password) {
      context.res = {
        status: 401,
        body: { error: "Invalid credentials" }
      };
      return;
    }

    // Return user info (excluding password)
    context.res = {
      status: 200,
      body: {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      }
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

