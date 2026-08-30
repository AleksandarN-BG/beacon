const auth = require("../shared/auth");
const cosmos = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
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

    const container = cosmos.container("users");
    if (!container) {
      context.res = {
        status: 503,
        body: { error: "Database not configured. Please set COSMOS_CONNECTION_STRING in application settings." }
      };
      return;
    }

    const method = req.method.toUpperCase();

    switch (method) {
      case "GET": {
        // Support for getting current user's profile with augmented roles
        if (req.query.me === "true") {
          context.res = {
            status: 200,
            body: {
              id: currentUser.id,
              name: currentUser.name,
              roles: currentUser.roles
            }
          };
          return;
        }

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

