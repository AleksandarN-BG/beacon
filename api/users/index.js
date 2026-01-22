const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
  try {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || "beacon";
    const containerId = process.env.COSMOS_CONTAINER_USERS || "users";

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

