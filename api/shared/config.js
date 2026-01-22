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
  }
};
