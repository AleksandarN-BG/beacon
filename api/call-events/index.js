const qs = require("querystring");

module.exports = async function (context, req) {
  // Handle call automation events (call connected, call ended, etc.)
  // Twilio sends status callbacks as POST requests with application/x-www-form-urlencoded
  let payload = {};
  if (req.body) {
    if (typeof req.body === "string") {
      payload = qs.parse(req.body);
    } else if (Buffer.isBuffer(req.body)) {
      payload = qs.parse(req.body.toString());
    } else {
      payload = req.body;
    }
  }
  
  // Twilio status callback parameters: CallSid, CallStatus, To, From, etc.
  const callSid = payload.CallSid;
  const callStatus = payload.CallStatus;

  if (callSid) {
    context.log(`Twilio Call Event: CallSid=${callSid}, Status=${callStatus}`);
    
    // You could store this status in a database to track alert delivery
    // For now, we'll just log it
  } else {
    // Legacy/Mixed support for other event types if any
    context.log("Call event received (unknown format):", JSON.stringify(payload));
  }

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { received: true }
  };
};

