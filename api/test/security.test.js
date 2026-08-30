/*
 * Regression tests for the authorisation rules on the anonymous and
 * alert-triggering routes.
 *
 *   node --test test/
 *
 * Every case here corresponds to something that was once exploitable, so each
 * failure means a specific hole has reopened. Cosmos and Twilio are stubbed:
 * what is under test is who is allowed to do what, not whether Azure works.
 */
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "test_auth_token_1234567890";
process.env.TWILIO_PHONE_NUMBER = "+15550000000";
process.env.STATIC_WEB_APP_URL = "https://example.invalid";
process.env.COSMOS_CONNECTION_STRING = "AccountEndpoint=https://x/;AccountKey=y==;";
delete process.env.ALLOW_BODY_IDENTITY;
delete process.env.ALLOW_INSECURE_WEBHOOKS;

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const auth = require("../shared/auth");
const cosmos = require("../shared/cosmos");
const logger = require("../shared/logger");
const notify = require("../shared/notify");
const oncall = require("../shared/oncall");

// --- stubs, installed before the handlers are required ---------------------

const ON_CALL = { userId: "u1", name: "Milica", phone: "+38111111111" };
let written = [];
let dispatched = [];

cosmos.isConfigured = () => true;
cosmos.container = (name) => ({
  item: () => ({
    read: async () => ({ resource: name === "incidents" ? { id: "INC-1", title: "db down", status: "open" } : null }),
    replace: async (doc) => { written.push(doc); return { resource: doc }; },
  }),
  items: { create: async () => ({}), query: () => ({ fetchAll: async () => ({ resources: [] }) }) },
});
oncall.currentOnCall = async () => ON_CALL;
notify.sendSms = async (_c, a) => { dispatched.push({ kind: "sms", ...a }); return { sid: "SM1", status: "queued" }; };
notify.placeCall = async (_c, a) => { dispatched.push({ kind: "call", ...a }); return { sid: "CA1" }; };
logger.logSystemEvent = async () => ({});

const voiceTwiml = require("../voice-twiml");
const callEvents = require("../call-events");
const alertCall = require("../alert-call");
const alertSms = require("../alert-sms");

// --- helpers --------------------------------------------------------------

function ctx() {
  const log = Object.assign(() => {}, { error: () => {}, warn: () => {} });
  return { res: null, log };
}

/** The signature Twilio would send: HMAC-SHA1 of the URL plus sorted params. */
function twilioSignature(url, params) {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return crypto.createHmac("sha1", process.env.TWILIO_AUTH_TOKEN).update(Buffer.from(payload, "utf8")).digest("base64");
}

/** What Static Web Apps injects for a signed-in caller. */
function clientPrincipal(userRoles) {
  const principal = { userId: "u9", userDetails: "someone", identityProvider: "aad", userRoles };
  return Buffer.from(JSON.stringify(principal)).toString("base64");
}

test.beforeEach(() => { written = []; dispatched = []; });

// --- the anonymous voice webhook -----------------------------------------

test("GET cannot acknowledge an incident, however it is parameterised", async () => {
  const c = ctx();
  await voiceTwiml(c, {
    method: "GET",
    query: { incidentId: "INC-1", Digits: "1" },
    headers: {},
    url: "/api/voice-twiml?incidentId=INC-1&Digits=1",
  });

  // This exact request used to acknowledge the incident from a browser bar.
  assert.equal(written.length, 0, "GET must never write to an incident");
  assert.equal(c.res.status, 200);
  assert.match(c.res.body, /Beacon Voice API is active/, "GET is a liveness check and nothing else");
});

test("POST without a Twilio signature is refused", async () => {
  const c = ctx();
  await voiceTwiml(c, {
    method: "POST", query: { incidentId: "INC-1" }, headers: {},
    body: { Digits: "1" }, url: "/api/voice-twiml?incidentId=INC-1",
  });

  assert.equal(c.res.status, 403);
  assert.equal(written.length, 0);
});

test("POST with a forged signature is refused", async () => {
  const c = ctx();
  await voiceTwiml(c, {
    method: "POST", query: { incidentId: "INC-1" },
    headers: { "x-twilio-signature": "not-a-real-signature" },
    body: { Digits: "1" }, url: "/api/voice-twiml?incidentId=INC-1",
  });

  assert.equal(c.res.status, 403);
  assert.equal(written.length, 0);
});

test("POST with a valid signature acknowledges, attributed to the on-call engineer", async () => {
  const url = "https://example.invalid/api/voice-twiml?incidentId=INC-1";
  const body = { Digits: "1" };
  const c = ctx();

  await voiceTwiml(c, {
    method: "POST", query: { incidentId: "INC-1" },
    headers: { "x-twilio-signature": twilioSignature(url, body) },
    body, url: "/api/voice-twiml?incidentId=INC-1",
  });

  assert.equal(written.length, 1, "the legitimate Twilio path must still work");
  assert.equal(written[0].status, "acknowledged");
  assert.equal(written[0].acknowledgedVia, "voice");
  // Attribution comes from the schedule, not from whoever holds the handset.
  assert.equal(written[0].assignedTo, ON_CALL.name);
});

test("call-events refuses an unsigned status callback", async () => {
  const c = ctx();
  await callEvents(c, {
    method: "POST", headers: {}, body: { CallSid: "CA1", CallStatus: "completed" },
    url: "/api/call-events",
  });
  assert.equal(c.res.status, 403);
});

// --- the alert endpoints --------------------------------------------------

for (const [name, handler] of [["alert-call", alertCall], ["alert-sms", alertSms]]) {
  test(`${name} refuses a merely authenticated caller`, async () => {
    const c = ctx();
    await handler(c, {
      method: "POST",
      headers: { "x-ms-client-principal": clientPrincipal(["authenticated"]) },
      body: { phone: "+99999999999", service: "x", incidentId: "INC-1" },
      query: {},
    });

    // The identity provider is the `common` tenant, so "authenticated" means
    // any Microsoft account in existence. It is not a permission.
    assert.equal(c.res.status, 403);
    assert.equal(dispatched.length, 0, "nothing may be sent");
  });

  test(`${name} ignores a caller-supplied phone number`, async () => {
    const c = ctx();
    await handler(c, {
      method: "POST",
      headers: { "x-ms-client-principal": clientPrincipal(["engineer"]) },
      body: { phone: "+99999999999", service: "x", incidentId: "INC-1" },
      query: {},
    });

    assert.equal(c.res.status, 200, "an engineer is allowed to test paging");
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].to, ON_CALL.phone, "the destination comes from the schedule");
  });
}

// --- identity ------------------------------------------------------------

test("identity cannot be taken from the request body", async () => {
  const forged = await auth.getUser(ctx(), {
    headers: {},
    body: { userId: "attacker", userRoles: ["admin"] },
  });
  assert.equal(forged, null, "only the platform-injected header establishes identity");
});
