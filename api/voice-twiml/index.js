/*
 * The voice side of an escalation: Twilio fetches TwiML from here, reads the
 * alert out, and posts back whichever key the engineer pressed. Pressing 1
 * acknowledges the incident.
 *
 * This route is anonymous at the Static Web Apps level because Twilio cannot
 * authenticate against Azure AD, so the handler is the only gate there is.
 * Two rules follow from that:
 *
 *   1. Anything that changes state requires a valid Twilio signature.
 *   2. Only POST can change state. Twilio fetches TwiML with POST and posts
 *      the gather result, so GET is never part of a real call -- it exists so
 *      a human can check the endpoint is alive, and it answers with a fixed
 *      string without reading a single parameter.
 *
 * Previously both `incidentId` and `Digits` were read from the query string on
 * any method with no signature check, so requesting
 * `/api/voice-twiml?incidentId=<id>&Digits=1` in a browser acknowledged that
 * incident and attributed it to whoever was on call.
 */
const twilio = require("twilio");
const cosmos = require("../shared/cosmos");
const logger = require("../shared/logger");
const oncall = require("../shared/oncall");
const webhook = require("../shared/twilio-webhook");

module.exports = async function (context, req) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const reply = () => {
    context.res = {
      status: 200,
      headers: { "Content-Type": "text/xml" },
      body: response.toString(),
    };
  };

  // Liveness only. Deliberately reads no parameters, so it cannot be turned
  // into an acknowledgement by adding a query string.
  if (req.method === "GET") {
    response.say("Beacon Voice API is active.");
    reply();
    return;
  }

  const verified = webhook.verify(context, req);
  if (!verified.ok) {
    context.log.warn(`[VoiceTwiML] Rejected unverified webhook: ${verified.reason}`);
    context.res = { status: 403, body: { error: "Invalid webhook signature" } };
    return;
  }

  try {
    const body = webhook.bodyParams(req);

    // incidentId travels in the signed URL's query string; Digits arrives in
    // the signed POST body. Both are covered by the signature just verified.
    const incidentId = req.query.incidentId || body.incidentId;
    const digits = body.Digits;

    if (digits === "1" && incidentId) {
      await acknowledge(context, response, incidentId);
    } else if (digits) {
      await logger.logSystemEvent(context, "info", `Unexpected keypress: ${digits}`);
      response.say(`You pressed ${digits}. Please try again or check the dashboard.`);
    } else {
      // The initial TwiML fetch: read the alert out and wait for a keypress.
      const message = req.query.message || "Beacon Alert System. Press 1 to acknowledge.";
      const gather = response.gather({
        input: "dtmf",
        numDigits: 1,
        action: `/api/voice-twiml?incidentId=${encodeURIComponent(incidentId || "")}`,
        method: "POST",
        timeout: 10,
      });
      gather.say(message);
      response.say("We did not receive a response. Please check the dashboard for more details. Goodbye.");
    }

    reply();
  } catch (error) {
    context.log.error(`[VoiceTwiML] ${error.message}`);

    // Always answer with TwiML: a non-XML body makes Twilio play its own
    // generic failure message, which tells the engineer nothing.
    const failure = new VoiceResponse();
    failure.say("An application error occurred. Please check the system logs.");
    context.res = {
      status: 200,
      headers: { "Content-Type": "text/xml" },
      body: failure.toString(),
    };
  }
};

/** Mark the incident acknowledged, and say who it was attributed to. */
async function acknowledge(context, response, incidentId) {
  const incidents = cosmos.container("incidents");
  if (!incidents) {
    await logger.logSystemEvent(context, "error", "Cannot acknowledge: database not configured");
    response.say("System configuration error. Please use the dashboard.");
    return;
  }

  const { resource: incident } = await incidents.item(incidentId, incidentId).read();

  if (!incident) {
    await logger.logSystemEvent(context, "warn", `Acknowledgement for unknown incident ${incidentId}`);
    response.say("I'm sorry, I couldn't find that incident in our records.");
    return;
  }

  if (incident.acknowledgedAt) {
    response.say("This incident has already been acknowledged. Thank you, goodbye.");
    return;
  }

  // The engineer who was paged is the one whose shift covers this moment, not
  // whoever happens to be holding the phone.
  const engineer = await oncall.currentOnCall(context);

  await incidents.item(incidentId, incidentId).replace({
    ...incident,
    status: "acknowledged",
    acknowledgedAt: new Date().toISOString(),
    acknowledgedVia: "voice",
    updatedAt: new Date().toISOString(),
    assignedTo: engineer?.name ?? "Unknown",
    assignedToId: engineer?.userId ?? null,
    assignedToPhone: engineer?.phone ?? null,
  });

  await logger.logSystemEvent(
    context,
    "info",
    `Incident ${incidentId} acknowledged by voice (${engineer?.name ?? "unknown engineer"})`,
  );

  response.say(`Thank you ${engineer?.name ?? ""}. The incident has been acknowledged. Goodbye.`);
}
