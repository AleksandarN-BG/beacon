const path = require('path');

// Load .env only if it exists (mainly for local development)
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch (e) {
  // dotenv might not be installed in all environments, or .env might be missing
  // This is fine as we primarily rely on actual environment variables in production
}

module.exports = {
  cosmos: {
    connectionString: process.env.COSMOS_CONNECTION_STRING,
    staticWebAppUrl: process.env.STATIC_WEB_APP_URL || null,
    database: process.env.COSMOS_DATABASE || "beacon",
    containers: {
      users: process.env.COSMOS_CONTAINER_USERS || "users",
      incidents: process.env.COSMOS_CONTAINER_INCIDENTS || "incidents",
      schedule: process.env.COSMOS_CONTAINER_SCHEDULE || "schedule",
      monitors: process.env.COSMOS_CONTAINER_MONITORS || "monitors",
      logs: process.env.COSMOS_CONTAINER_LOGS || "uptimeLogs"
    }
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  auth: {
    clientId: process.env.AAD_CLIENT_ID,
    clientSecret: process.env.AAD_CLIENT_SECRET
  },
  system: {
    hostname: process.env.WEBSITE_HOSTNAME
  },
  dev: {
    /*
     * Local-only escape hatch. The x-ms-client-principal header is injected by
     * Static Web Apps and cannot be forged by a caller; a request body can be.
     * Setting this to "true" lets the API take identity from the body so the
     * Functions host can be exercised without SWA in front of it.
     *
     * It must never be set in a deployed environment: with it on, any caller
     * can name themselves any user and claim any role.
     */
    allowBodyIdentity: process.env.ALLOW_BODY_IDENTITY === "true",

    /*
     * Local-only escape hatch, same shape as the one above. Twilio signs every
     * webhook with the account auth token; without a real Twilio calling in,
     * nothing can produce a valid signature, so exercising voice-twiml or
     * call-events by hand needs the check turned off.
     *
     * It must never be set in a deployed environment: with it on, anyone can
     * acknowledge any incident by requesting a URL.
     */
    allowInsecureWebhooks: process.env.ALLOW_INSECURE_WEBHOOKS === "true"
  }
};
