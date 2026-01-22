const twilio = require('twilio');
const config = require("../shared/config");
const auth = require("../shared/auth");
const logger = require("../shared/logger");

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
      await logger.logSystemEvent(context, 'error', "Twilio not configured in application settings");
      context.res = {
        status: 500,
        body: { error: "Twilio not configured" }
      };
      return;
    }

    const { phone, service, incidentId } = req.body;

    if (!phone || !service || !incidentId) {
      context.res = {
        status: 400,
        body: { error: "Missing required fields: phone, service, incidentId" }
      };
      return;
    }

    await logger.logSystemEvent(context, 'info', `Initiating escalation call for ${service} to ${phone}`);

    const client = twilio(accountSid, authToken);

    const host = req.headers['host'] || config.system.hostname || 'localhost:7071';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const callbackBaseUrl = `${protocol}://${host}`;

    // Construct the message that will be spoken to the user
    const message = `Critical Beacon Alert: ${service} is experiencing issues. Press 1 to acknowledge this incident.`;

    // The URL for Twilio to fetch TwiML from. We pass the incidentId and the message.
    const twimlUrl = new URL(`${callbackBaseUrl}/api/voice-twiml`);
    twimlUrl.searchParams.append('incidentId', incidentId);
    twimlUrl.searchParams.append('message', message);

    try {
      const call = await client.calls.create({
        url: twimlUrl.toString(), // Use URL to fetch TwiML
        to: phone,
        from: fromNumber,
        statusCallback: `${callbackBaseUrl}/api/call-events`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      });

      await logger.logSystemEvent(context, 'info', `Call initiated successfully: ${call.sid}`);

      context.res = {
        status: 200,
        body: {
          success: true,
          callSid: call.sid
        }
      };
    } catch (err) {
      await logger.logSystemEvent(context, 'error', `Twilio API error during call creation: ${err.message}`, err);
      throw err;
    }
  } catch (error) {
    context.log.error(`Error initiating call: ${error.message}`);
    // Return error details in the response for browser debugging
    context.res = {
      status: 500,
      body: {
        error: error.message,
        stack: error.stack // Include stack trace for debugging
      }
    };
  }
};
