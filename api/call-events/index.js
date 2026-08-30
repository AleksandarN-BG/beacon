/*
 * Twilio status callbacks: call initiated, ringing, answered, completed, and
 * the equivalents for SMS delivery.
 *
 * Anonymous by necessity -- Twilio cannot authenticate against Azure AD -- so
 * the signature is what establishes the caller. Unverified, this endpoint is
 * only a log-spam vector rather than a data risk, but an alerting product that
 * accepts unauthenticated call history is recording fiction.
 */
const webhook = require("../shared/twilio-webhook");

module.exports = async function (context, req) {
  const verified = webhook.verify(context, req);
  if (!verified.ok) {
    context.log.warn(`[CallEvents] Rejected unverified webhook: ${verified.reason}`);
    context.res = { status: 403, body: { error: "Invalid webhook signature" } };
    return;
  }

  const payload = webhook.bodyParams(req);
  const { CallSid, CallStatus, MessageSid, MessageStatus } = payload;

  if (CallSid) {
    context.log(`[CallEvents] Call ${CallSid}: ${CallStatus}`);
  } else if (MessageSid) {
    context.log(`[CallEvents] Message ${MessageSid}: ${MessageStatus}`);
  } else {
    context.log.warn("[CallEvents] Verified webhook carried no CallSid or MessageSid");
  }

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: { received: true },
  };
};
