const twilio = require('twilio');
const config = require("../shared/config");
const auth = require("../shared/auth");
const logger = require("../shared/logger");

module.exports = async function (context, req) {
  try {
    // Authenticate user - any authenticated user can trigger alerts
    const currentUser = await auth.getUser(context, req);
    if (!currentUser) {
      context.res = {
        status: 401,
        body: { error: "Authentication required" }
      };
      return;
    }

    const accountSid = config.twilio.accountSid;
    const authToken = config.twilio.authToken;
    const fromNumber = config.twilio.phoneNumber;

    if (!accountSid || !authToken || !fromNumber) {
      await logger.logSystemEvent(context, 'error', "Twilio not configured in application settings");
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

    await logger.logSystemEvent(context, 'info', `Sending SMS alert for ${service} to ${phone}`);

    const client = twilio(accountSid, authToken);

    // Use Static Web App URL for callbacks
    const staticWebAppUrl = config.system.staticWebAppUrl || process.env.STATIC_WEB_APP_URL;
    const callbackBaseUrl = staticWebAppUrl || null;

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

      await logger.logSystemEvent(context, 'info', `SMS sent successfully: ${messageResponse.sid}`);

      context.res = {
        status: 200,
        body: {
          success: true,
          messageId: messageResponse.sid,
          status: messageResponse.status
        }
      };
    } catch (err) {
      await logger.logSystemEvent(context, 'error', `Twilio SMS error: ${err.message}`, err);
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