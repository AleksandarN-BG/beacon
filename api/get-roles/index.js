const { CosmosClient } = require("@azure/cosmos");
const config = require("../shared/config");

module.exports = async function (context, req) {
  try {
    // Get user ID from the authentication header
    const header = req.headers["x-ms-client-principal"];

    if (!header) {
      context.res = {
        status: 401,
        body: { error: "Not authenticated" }
      };
      return;
    }

    const encoded = Buffer.from(header, "base64");
    const decoded = JSON.parse(encoded.toString("utf8"));
    const userId = decoded.userId;
    const userDetails = decoded.userDetails; // Username (GitHub) or email (Microsoft)
    const identityProvider = decoded.identityProvider; // "github" or "aad"

    // Default role for all authenticated users
    const roles = ["authenticated", "user"];

    // Check Cosmos DB for user roles
    const connectionString = config.cosmos.connectionString;

    if (connectionString) {
      const databaseId = config.cosmos.database;
      const containerId = config.cosmos.containers.users;
      const client = new CosmosClient(connectionString);
      const database = client.database(databaseId);
      const container = database.container(containerId);

      try {
        const querySpec = {
          query: "SELECT * FROM c WHERE c.id = @userId",
          parameters: [{ name: "@userId", value: userId }]
        };

        const { resources: users } = await container.items.query(querySpec).fetchAll();

        if (users.length > 0) {
          const user = users[0];
          const userRole = user.role;

          // Add role based on what's in the database
          if (userRole === "admin") {
            roles.push("admin");
            roles.push("engineer"); // Admins also have engineer privileges
          } else if (userRole === "engineer") {
            roles.push("engineer");
          }
          // "user" is already in roles by default

          // Update last login time
          await container.items.upsert({
            ...user,
            lastLogin: new Date().toISOString()
          });
        } else {
          // First-time login - create user with default "user" role
          const newUser = {
            id: userId,
            identityProvider: identityProvider,
            displayName: userDetails,
            email: identityProvider === "aad" ? userDetails : null,
            username: identityProvider === "github" ? userDetails : null,
            role: "user", // Default role for new users
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };

          await container.items.create(newUser);
          context.log("Created new user:", userId);
        }
      } catch (dbError) {
        // If users container doesn't exist or query fails, just use default roles
        context.log("Could not query user roles:", dbError.message);
      }
    }

    // Return roles in the format expected by Static Web Apps
    context.res = {
      status: 200,
      body: { roles: roles }
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

