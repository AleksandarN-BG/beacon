const qs = require("querystring");

module.exports = async function (context, req) {
  // Handle call automation events (call connected, call ended, etc.)
  // Twilio sends status callbacks as POST requests with application/x-www-form-urlencoded
  let payload = {};
  const rawBody = req.rawBody || req.body;
  
  if (rawBody) {
    if (typeof rawBody === "string") {
      payload = qs.parse(rawBody);
    } else if (Buffer.isBuffer(rawBody)) {
      payload = qs.parse(rawBody.toString());
    } else if (typeof rawBody === "object") {
      payload = rawBody;
    }
  }
  
  // Twilio status callback parameters: CallSid, CallStatus, To, From, etc.
  const callSid = payload.CallSid;
  const callStatus = payload.CallStatus;

  if (callSid) {
    context.log(`Twilio Call Event: CallSid=${callSid}, Status=${callStatus}`);
  } else {
    context.log("Call event received with no CallSid:", JSON.stringify(payload));
  }

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { received: true }
  };
};

