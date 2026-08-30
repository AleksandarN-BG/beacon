/*
 * Outbound SMS and voice, in one place.
 *
 * The sending used to live inside the alert-sms and alert-call HTTP handlers,
 * which meant incidents/index.js reached them by building a synthetic request
 * and monkey-patching the shared auth module:
 *
 *     auth.getUser = async () => currentUser;   // then restore in a finally
 *
 * That mutates state shared by every concurrent invocation on the same worker,
 * so a second request arriving mid-alert would have seen the patched version.
 * With the work extracted here, both the handlers and the incident pipeline
 * call the same functions directly and nothing needs faking.
 */
const twilio = require("twilio");
const config = require("./config");
const logger = require("./logger");

/** Twilio has to reach our webhooks through SWA, which fronts the anonymous routes. */
function callbackBase() {
  return config.system.staticWebAppUrl || process.env.STATIC_WEB_APP_URL || null;
}

function client() {
  const { accountSid, authToken, phoneNumber } = config.twilio;
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Twilio is not configured (account SID, auth token and phone number are all required)");
  }
  return { api: twilio(accountSid, authToken), from: phoneNumber };
}

function isConfigured() {
  const { accountSid, authToken, phoneNumber } = config.twilio;
  return Boolean(accountSid && authToken && phoneNumber);
}

/**
 * Text the on-call engineer.
 * @param {{to: string, service: string, status?: string}} alert
 */
async function sendSms(context, { to, service, status }) {
  const { api, from } = client();
  const base = callbackBase();

  const body =
    status === "up" ? `Beacon Alert: ${service} is back UP` : `Beacon Alert: ${service} is DOWN`;

  const message = await api.messages.create({
    body,
    from,
    to,
    statusCallback: base ? `${base}/api/call-events` : undefined,
  });

  await logger.logSystemEvent(context, "info", `SMS sent to on-call engineer: ${message.sid}`);
  return { sid: message.sid, status: message.status };
}

/**
 * Ring the on-call engineer and offer to acknowledge by keypad.
 *
 * The TwiML URL carries the incident id, and Twilio signs the whole URL --
 * query string included -- so voice-twiml can verify the request came from
 * Twilio and not from someone who guessed an incident id.
 *
 * @param {{to: string, service: string, incidentId: string}} alert
 */
async function placeCall(context, { to, service, incidentId }) {
  const { api, from } = client();
  const base = callbackBase();

  if (!base) {
    throw new Error(
      "STATIC_WEB_APP_URL is not set. Twilio must fetch TwiML through Static Web Apps, " +
        "because the Function App itself requires authentication.",
    );
  }

  const twimlUrl = new URL(`${base}/api/voice-twiml`);
  twimlUrl.searchParams.append("incidentId", incidentId);
  twimlUrl.searchParams.append(
    "message",
    `Critical Beacon Alert: ${service} is experiencing issues. Press 1 to acknowledge this incident.`,
  );

  const call = await api.calls.create({
    url: twimlUrl.toString(),
    to,
    from,
    statusCallback: `${base}/api/call-events`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  });

  await logger.logSystemEvent(context, "info", `Escalation call placed: ${call.sid}`);
  return { sid: call.sid };
}

module.exports = { sendSms, placeCall, isConfigured };
