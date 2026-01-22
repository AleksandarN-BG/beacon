const { CosmosClient } = require("@azure/cosmos");
const config = require("../shared/config");
const auth = require("../shared/auth");

module.exports = async function (context, req) {
  try {
    const connectionString = config.cosmos.connectionString;
    const databaseId = config.cosmos.database;
    const containerId = config.cosmos.containers.users;

    // Get current user using shared auth helper
    const currentUser = await auth.getUser(context, req);

    if (!currentUser) {
      context.res = {
        status: 401,
        body: { error: "Authentication required" }
      };
      return;
    }

    const isAdmin = currentUser.roles.includes("admin") || false;

    if (!connectionString) {
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
        // Only admins can list all users
        if (!isAdmin) {
          // Non-admins can only get their own info
          const { resources: users } = await container.items
            .query({
              query: "SELECT * FROM c WHERE c.id = @userId",
              parameters: [{ name: "@userId", value: currentUser.id }]
            })
            .fetchAll();

          if (users.length === 0) {
            context.res = { status: 404, body: { error: "User not found" } };
            return;
          }

          context.res = { status: 200, body: { user: users[0] } };
          return;
        }

        // Admin: list all users
        const { resources: users } = await container.items
          .query("SELECT * FROM c ORDER BY c.createdAt DESC")
          .fetchAll();

        context.res = { status: 200, body: { users } };
        break;
      }

      case "PUT": {
        // Only admins can update user roles
        if (!isAdmin) {
          context.res = {
            status: 403,
            body: { error: "Only admins can update user roles" }
          };
          return;
        }

        const { userId, role, displayName } = req.body;

        if (!userId) {
          context.res = {
            status: 400,
            body: { error: "Missing required field: userId" }
          };
          return;
        }

        // Validate role if provided
        if (role && !["user", "engineer", "admin"].includes(role)) {
          context.res = {
            status: 400,
            body: { error: "Invalid role. Must be: user, engineer, or admin" }
          };
          return;
        }

        // Get existing user
        const { resources: users } = await container.items
          .query({
            query: "SELECT * FROM c WHERE c.id = @userId",
            parameters: [{ name: "@userId", value: userId }]
          })
          .fetchAll();

        if (users.length === 0) {
          context.res = { status: 404, body: { error: "User not found" } };
          return;
        }

        const existingUser = users[0];

        // Update user
        const updatedUser = {
          ...existingUser,
          ...(role && { role }),
          ...(displayName && { displayName }),
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.id
        };

        await container.items.upsert(updatedUser);

        context.res = {
          status: 200,
          body: { message: "User updated successfully", user: updatedUser }
        };
        break;
      }

      default:
        context.res = { status: 405, body: { error: "Method not allowed" } };
    }
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

