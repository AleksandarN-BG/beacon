const twilio = require('twilio');
const config = require("../shared/config");
const auth = require("../shared/auth");

module.exports = async function (context, req) {
  try {
    // Authenticate user
    const currentUser = await auth.getUser(context, req);
    if (!currentUser) {
      context.res = {
        status: 401,
        body: { error: "Authentication required" }
      };
      return;
    }

    // Only admins and engineers can trigger alerts manually
    const isAdmin = currentUser.roles.includes("admin");
    const isEngineer = currentUser.roles.includes("engineer");
    if (!isAdmin && !isEngineer) {
      context.res = {
        status: 403,
        body: { error: "Permission denied. Only admins and engineers can trigger alerts." }
      };
      return;
    }

    const accountSid = config.twilio.accountSid;
    const authToken = config.twilio.authToken;
    const fromNumber = config.twilio.phoneNumber;

    if (!accountSid || !authToken || !fromNumber) {
      context.res = {
        status: 500,
        body: { error: "Twilio not configured" }
      };
      return;
    }

    const { phone, service, status } = req.body;

    if (!phone || !service) {
      context.res = {
        status: 400,
        body: { error: "Missing required fields: phone, service" }
      };
      return;
    }

    const client = twilio(accountSid, authToken);

    const host = req.headers['host'] || config.system.hostname || 'localhost:7071';
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const callbackBaseUrl = host ? `${protocol}://${host}` : null;

    const message = status === "up"
      ? `Beacon Alert: ${service} is back UP`
      : `Beacon Alert: ${service} is DOWN`;

    try {
      const messageResponse = await client.messages.create({
        body: message,
        from: fromNumber,
        to: phone,
        statusCallback: callbackBaseUrl ? `${callbackBaseUrl}/api/call-events` : undefined
      });

      context.res = {
        status: 200,
        body: { success: true, messageId: messageResponse.sid, status: messageResponse.status }
      };
    } catch (err) {
      context.log.error(`Twilio SMS Error: ${err.message}`);
      throw err;
    }
  } catch (error) {
    context.log.error(`Error sending SMS: ${error.message}`);
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

