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

    const { phone, service, incidentId } = req.body;

    if (!phone || !service) {
      context.res = {
        status: 400,
        body: { error: "Missing required fields: phone, service" }
      };
      return;
    }

    const client = twilio(accountSid, authToken);
    const VoiceResponse = twilio.twiml.VoiceResponse;

    const host = req.headers['host'] || config.system.hostname || 'localhost:7071';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const callbackBaseUrl = `${protocol}://${host}`;

    const response = new VoiceResponse();
    const gather = response.gather({
      action: `${callbackBaseUrl}/api/voice-twiml?incidentId=${incidentId}`,
      numDigits: '1',
      timeout: 10
    });
    
    gather.say({ voice: 'Polly.Joanna-Generative' }, 
      `Critical Beacon Alert: ${service} is experiencing issues. Press 1 to acknowledge this incident.`
    );
    
    response.say({ voice: 'Polly.Joanna-Generative' }, "We did not receive any input. Goodbye.");

    const call = await client.calls.create({
      twiml: response.toString(),
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

