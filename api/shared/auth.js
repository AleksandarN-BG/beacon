const { CosmosClient } = require("@azure/cosmos");
const config = require("./config");

async function getUser(context, req) {
  let decoded;
  const header = req.headers["x-ms-client-principal"];
  
  if (header) {
    try {
      const encoded = Buffer.from(header, "base64");
      decoded = JSON.parse(encoded.toString("utf8"));
    } catch (e) {
      context.log.error("Failed to decode client principal header");
    }
  } else if (req.body && req.body.userId) {
    decoded = req.body;
  }

  if (!decoded) return null;

  try {
    const user = {
      id: decoded.userId,
      name: decoded.userDetails,
      provider: decoded.identityProvider,
      roles: decoded.userRoles || []
    };

    // If roles already include admin/engineer from SWA (Standard Plan), we're good
    if (user.roles.includes("admin") || user.roles.includes("engineer")) {
      return user;
    }

    // Otherwise, we check Cosmos DB (SWA Free Plan support)
    const connectionString = config.cosmos.connectionString;
    if (!connectionString) return user;

    const client = new CosmosClient(connectionString);
    const database = client.database(config.cosmos.database);
    const container = database.container(config.cosmos.containers.users);

    try {
      const { resource: dbUser } = await container.item(user.id, user.id).read();

      if (dbUser) {
        // Add roles from database
        if (dbUser.role === "admin") {
          if (!user.roles.includes("admin")) user.roles.push("admin");
          if (!user.roles.includes("engineer")) user.roles.push("engineer");
        } else if (dbUser.role === "engineer") {
          if (!user.roles.includes("engineer")) user.roles.push("engineer");
        }
        
        // Update last login (fire and forget)
        container.item(user.id, user.id).replace({
          ...dbUser,
          lastLogin: new Date().toISOString()
        }).catch(err => context.log.error(`Failed to update last login: ${err.message}`));
        
      } else {
        // First-time login on Free Plan - create user record
        const newUser = {
          id: user.id,
          identityProvider: user.provider,
          displayName: user.name,
          email: user.provider === "aad" ? user.name : null,
          role: "user",
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        
        await container.items.create(newUser).catch(err => {
          context.log.error(`Failed to auto-provision user ${user.id}: ${err.message}`);
        });
      }
    } catch (dbError) {
      context.log.error(`Error fetching user roles from DB: ${dbError.message}`);
    }

    return user;
  } catch (err) {
    context.log.error(`Error decoding client principal: ${err.message}`);
    return null;
  }
}

module.exports = {
  getUser
};
