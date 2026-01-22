const config = require("../shared/config");

module.exports = async function (context, req) {
  try {
    const header = req.headers["x-ms-client-principal"];
    let currentUser = null;
    if (header) {
      const encoded = Buffer.from(header, "base64");
      currentUser = JSON.parse(encoded.toString("utf8"));
    }

    if (!currentUser) {
      context.res = {
        status: 401,
        body: { error: "Authentication required" }
      };
      return;
    }

    const isAdmin = currentUser.userRoles && currentUser.userRoles.includes("admin");

    const debugInfo = {
      timestamp: new Date().toISOString(),
      user: {
        id: currentUser.userId,
        name: currentUser.userDetails,
        roles: currentUser.userRoles
      },
      configStatus: {
        COSMOS_CONNECTION_STRING: !!config.cosmos.connectionString,
        COSMOS_DATABASE: config.cosmos.database,
        TWILIO_ACCOUNT_SID: !!config.twilio.accountSid,
        TWILIO_AUTH_TOKEN: !!config.twilio.authToken,
        TWILIO_PHONE_NUMBER: !!config.twilio.phoneNumber,
        AAD_CLIENT_ID: !!config.auth.clientId,
        AAD_CLIENT_SECRET: !!config.auth.clientSecret,
        WEBSITE_HOSTNAME: process.env.WEBSITE_HOSTNAME || "not set"
      }
    };

    // Only show partial connection string and secrets to admins
    if (isAdmin) {
      debugInfo.secretsPreview = {
        COSMOS_START: config.cosmos.connectionString ? config.cosmos.connectionString.substring(0, 20) + "..." : "none",
        TWILIO_SID: config.twilio.accountSid ? config.twilio.accountSid.substring(0, 5) + "..." : "none"
      };
    }

    context.res = {
      status: 200,
      body: debugInfo
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};
