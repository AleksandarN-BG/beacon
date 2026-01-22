const twilio = require('twilio');
const config = require("../shared/config");

module.exports = async function (context, req) {
  try {
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

    const host = config.system.hostname || req.headers['host'];
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const callbackBaseUrl = host ? `${protocol}://${host}` : null;

    const message = status === "up"
      ? `Beacon Alert: ${service} is back UP`
      : `Beacon Alert: ${service} is DOWN`;

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
  } catch (error) {
    context.log.error(`Error sending SMS: ${error.message}`);
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

