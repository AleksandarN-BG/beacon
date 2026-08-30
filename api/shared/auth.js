const config = require("./config");
const cosmos = require("./cosmos");

async function getUser(context, req) {
  let decoded;
  const header = req.headers["x-ms-client-principal"];
  
  /*
   * Identity comes from the x-ms-client-principal header, which Static Web Apps
   * injects after authenticating the caller. It is the only trustworthy source
   * here: a request body is supplied by the caller, so treating it as identity
   * lets anyone claim any user id and any role -- including admin, which gates
   * incident creation and the outbound phone alerts.
   *
   * The body fallback survives only for running the Functions host locally
   * without SWA in front of it, and only when ALLOW_BODY_IDENTITY is explicitly
   * set. It is off unless someone turns it on.
   */
  if (header) {
    try {
      const encoded = Buffer.from(header, "base64");
      decoded = JSON.parse(encoded.toString("utf8"));
    } catch (e) {
      context.log.error("Failed to decode client principal header");
    }
  } else if (config.dev.allowBodyIdentity && req.body && req.body.userId) {
    context.log.warn(
      "Identity taken from the request body: ALLOW_BODY_IDENTITY is set. " +
        "This is a local-development setting and must not be enabled in Azure."
    );
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
    const container = cosmos.container("users");
    if (!container) return user;

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
