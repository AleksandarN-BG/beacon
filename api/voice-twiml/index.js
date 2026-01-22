const { CosmosClient } = require("@azure/cosmos");
const qs = require("querystring");
const twilio = require("twilio");
const config = require("../shared/config");
const logger = require("../shared/logger");

module.exports = async function (context, req) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const log = async (msg, level = 'info', details = null) => {
    try {
      await logger.logSystemEvent(context, level, msg, details);
    } catch (err) {
      context.log.error(`[VoiceTwiML] Logging error: ${err.message}`);
    }
  };

  try {
    await log(`Voice request received: ${req.method}`, 'info');

    let body = {};
    const rawBody = req.rawBody || req.body;

    if (rawBody) {
      if (typeof rawBody === "string") {
        body = qs.parse(rawBody);
      } else if (Buffer.isBuffer(rawBody)) {
        body = qs.parse(rawBody.toString());
      } else if (typeof rawBody === "object") {
        body = rawBody;
      }
    }

    const incidentId = req.query.incidentId || body.incidentId;
    const digits = body.Digits || req.query.Digits;

    await log(`Extracted: incidentId=${incidentId}, digits=${digits}`);

    if (req.method === 'GET' && !incidentId) {
      response.say("Beacon Voice API is active.");
      context.res = { status: 200, headers: { 'Content-Type': 'text/xml' }, body: response.toString() };
      return;
    }

    if (digits === "1" && incidentId) {
      await log(`Attempting to acknowledge incident: ${incidentId}`);
      const connectionString = config.cosmos.connectionString;
      if (!connectionString) {
        await log("Missing COSMOS_CONNECTION_STRING", 'error');
        response.say("System configuration error. Connection string missing.");
      } else {
        try {
          const client = new CosmosClient(connectionString);
          const database = client.database(config.cosmos.database);
          const incidentContainer = database.container(config.cosmos.containers.incidents);
          const scheduleContainer = database.container(config.cosmos.containers.schedule);
          const usersContainer = database.container(config.cosmos.containers.users);

          const { resource: existing } = await incidentContainer.item(incidentId, incidentId).read();

          if (existing) {
            if (!existing.acknowledgedAt) {
              const now = new Date().toISOString();
              const { resources: shifts } = await scheduleContainer.items
                .query({
                  query: "SELECT * FROM c WHERE c.startTime <= @now AND c.endTime >= @now",
                  parameters: [{ name: "@now", value: now }]
                })
                .fetchAll();

              let assignedTo = "Unknown";
              let assignedToId = null;

              if (shifts.length > 0) {
                assignedToId = shifts[0].userId;
                const { resource: user } = await usersContainer.item(assignedToId, assignedToId).read();
                if (user) {
                  assignedTo = user.name;
                }
              }

              const updated = {
                ...existing,
                status: "acknowledged",
                acknowledgedAt: new Date().toISOString(),
                acknowledgedVia: "voice",
                updatedAt: new Date().toISOString(),
                assignedTo,
                assignedToId,
              };

              await incidentContainer.item(incidentId, incidentId).replace(updated);
              await log(`Incident ${incidentId} successfully acknowledged via voice by ${assignedTo}`);
              response.say(`Thank you ${assignedTo}. The incident has been acknowledged. Goodbye.`);
            } else {
              await log(`Incident ${incidentId} was already acknowledged`, 'warn');
              response.say("This incident has already been acknowledged. Thank you, goodbye.");
            }
          } else {
            await log(`Incident not found: ${incidentId}`, 'warn');
            response.say("I'm sorry, I couldn't find that incident in our records.");
          }
        } catch (dbError) {
          await log(`Database error: ${dbError.message}`, 'error', dbError);
          response.say("There was a database error while acknowledging the incident. Please use the dashboard.");
        }
      }
    } else if (digits && digits !== "1") {
      await log(`Received unexpected digits: ${digits}`);
      response.say(`You pressed ${digits}. Please try again or check the dashboard.`);
    } else {
      await log("No digits received, gathering input for incident: " + incidentId, 'info');
      const message = req.query.message || "Beacon Alert System. Press 1 to acknowledge.";
      const gather = response.gather({
        input: 'dtmf',
        numDigits: 1,
        action: `/api/voice-twiml?incidentId=${incidentId}`,
        method: 'POST',
        timeout: 10
      });
      gather.say(message);
      response.say("We did not receive a response. Please check the dashboard for more details. Goodbye.");
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: response.toString()
    };
  } catch (error) {
    try {
      const safeMsg = (error && error.message) ? error.message.replace(/[^a-zA-Z0-9 .,:;\-]/g, " ") : "Unknown error";
      await log(`Top-level error: ${safeMsg}`, 'error', error);

      const errorResponse = new VoiceResponse();
      errorResponse.say("An application error occurred. Please check the system logs.");
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: errorResponse.toString()
      };
    } catch (fatal) {
      context.log.error(`[VoiceTwiML] Fatal error in error handler: ${fatal && fatal.message}`);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: '<?xml version="1.0" encoding="UTF-8"?><Response><Say>A fatal error occurred in the voice handler. Please check the logs.</Say></Response>'
      };
    }
  }
};
