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

    const { phone, service, incidentId } = req.body;

    if (!phone || !service) {
      context.res = {
        status: 400,
        body: { error: "Missing required fields: phone, service" }
      };
      return;
    }

    const client = twilio(accountSid, authToken);

    const host = config.system.hostname || req.headers['host'] || 'localhost:7071';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const callbackBaseUrl = `${protocol}://${host}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${callbackBaseUrl}/api/voice-twiml?incidentId=${incidentId}" numDigits="1" timeout="10">
    <Say voice="Polly.Joanna-Generative">
      Critical Beacon Alert: ${service} is experiencing issues. 
      Press 1 to acknowledge this incident.
    </Say>
  </Gather>
  <Say voice="Polly.Joanna-Generative">We did not receive any input. Goodbye.</Say>
</Response>`;

    const call = await client.calls.create({
      twiml: twiml,
      to: phone,
      from: fromNumber,
      statusCallback: `${callbackBaseUrl}/api/call-events`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    context.res = {
      status: 200,
      body: {
        success: true,
        callSid: call.sid
      }
    };
  } catch (error) {
    context.log.error(`Error initiating call: ${error.message}`);
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

