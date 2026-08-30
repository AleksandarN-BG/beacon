/*
 * Proof that a webhook request actually came from Twilio.
 *
 * /api/voice-twiml and /api/call-events must be anonymous -- Twilio has no way
 * to authenticate against Azure AD -- so the SWA route config cannot protect
 * them and the handler is the only possible gate. Without one, anyone could
 * call voice-twiml with an incident id and a Digits value and mark that
 * incident acknowledged: the alerted engineer would never be paged again, and
 * the acknowledgement would be attributed to whoever was on call.
 *
 * Twilio signs each request with HMAC-SHA1 over the full URL plus the sorted
 * POST body, keyed by the account auth token. Only Twilio and we know that key.
 */
const twilio = require("twilio");
const config = require("./config");

/**
 * Rebuild the URL Twilio signed.
 *
 * The signature covers the exact URL Twilio requested, but the request reaches
 * the Function through SWA's proxy, so req.url may carry the internal host.
 * Every candidate below is a URL we control, so trying each costs nothing and
 * tolerates the proxy rewriting the host.
 */
function candidateUrls(req) {
  const candidates = [];
  const base = config.system.staticWebAppUrl || process.env.STATIC_WEB_APP_URL;

  const pathAndQuery = (() => {
    try {
      const parsed = new URL(req.url, "http://placeholder");
      return parsed.pathname + parsed.search;
    } catch {
      return req.url || "";
    }
  })();

  if (base) candidates.push(`${base.replace(/\/$/, "")}${pathAndQuery}`);
  if (req.originalUrl) candidates.push(req.originalUrl);
  if (req.url && /^https?:\/\//.test(req.url)) candidates.push(req.url);

  return [...new Set(candidates)];
}

/**
 * @returns {{ok: true} | {ok: false, reason: string}}
 *
 * Fails closed. A missing auth token means the signature cannot be checked at
 * all, which is a reason to reject rather than to wave the request through.
 */
function verify(context, req) {
  if (config.dev.allowInsecureWebhooks) {
    context.log.warn(
      "[TwilioWebhook] Signature check skipped: ALLOW_INSECURE_WEBHOOKS is set. " +
        "This is a local-development setting and must not be enabled in Azure.",
    );
    return { ok: true };
  }

  const authToken = config.twilio.authToken;
  if (!authToken) {
    return { ok: false, reason: "TWILIO_AUTH_TOKEN is not configured, so the signature cannot be verified" };
  }

  const signature = req.headers["x-twilio-signature"];
  if (!signature) {
    return { ok: false, reason: "missing X-Twilio-Signature header" };
  }

  // Twilio signs the form-encoded parameters, which for a GET is nothing.
  const params = req.method === "POST" ? bodyParams(req) : {};

  for (const url of candidateUrls(req)) {
    if (twilio.validateRequest(authToken, signature, url, params)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: "signature did not match any expected request URL" };
}

/** Twilio posts application/x-www-form-urlencoded; the host may or may not have parsed it. */
function bodyParams(req) {
  const raw = req.rawBody ?? req.body;

  if (!raw) return {};
  if (typeof raw === "string") return Object.fromEntries(new URLSearchParams(raw));
  if (Buffer.isBuffer(raw)) return Object.fromEntries(new URLSearchParams(raw.toString()));
  if (typeof raw === "object") return raw;
  return {};
}

module.exports = { verify, bodyParams };
