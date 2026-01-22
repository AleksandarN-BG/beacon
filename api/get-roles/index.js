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

    if (!connectionString) {
      context.log.warn("COSMOS_CONNECTION_STRING is missing. Using default roles.");
    } else {
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
          context.log(`Found existing user ${userId} with role ${userRole}`);

          // Add role based on what's in the database
          if (userRole === "admin") {
            roles.push("admin");
            roles.push("engineer"); 
          } else if (userRole === "engineer") {
            roles.push("engineer");
          }

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

          try {
            await container.items.create(newUser);
            context.log(`Created new user record for ${userId} (${userDetails})`);
          } catch (createError) {
            context.log.error(`Failed to create user record for ${userId}: ${createError.message}`);
          }
        }
      } catch (dbError) {
        context.log.error(`Database error during role retrieval for ${userId}: ${dbError.message}`);
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

