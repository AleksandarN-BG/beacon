const { CosmosClient } = require("@azure/cosmos");
const qs = require("querystring");
const twilio = require("twilio");
const config = require("../shared/config");

module.exports = async function (context, req) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Helper to log both to context and console for maximum visibility
  const log = (msg, level = 'info') => {
    const formattedMsg = `[VoiceTwiML] ${msg}`;
    if (level === 'error') {
      context.log.error(formattedMsg);
      console.error(formattedMsg);
    } else if (level === 'warn') {
      context.log.warn(formattedMsg);
      console.warn(formattedMsg);
    } else {
      context.log(formattedMsg);
      console.log(formattedMsg);
    }
  };

  try {
    log(`Request Method: ${req.method}`);
    
    // Twilio sends data as application/x-www-form-urlencoded
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

    // Try to get incidentId from query first, then body
    const incidentId = req.query.incidentId || body.incidentId;
    // Twilio Digits is usually in the body for the 'action' callback of a <Gather>
    const digits = body.Digits || req.query.Digits;

    log(`Extracted: incidentId=${incidentId}, digits=${digits}`);
    
    // If it's a GET, it might just be a manual check or a heartbeat
    if (req.method === 'GET' && !digits) {
        response.say({ voice: 'Polly.Joanna-Generative' }, "Beacon Voice API is active.");
        context.res = { status: 200, headers: { 'Content-Type': 'text/xml' }, body: response.toString() };
        return;
    }

    if (digits === "1" && incidentId) {
      log(`Attempting to acknowledge incident: ${incidentId}`);
      
      const connectionString = config.cosmos.connectionString;
      if (!connectionString) {
        log("Missing COSMOS_CONNECTION_STRING", 'error');
        response.say({ voice: 'Polly.Joanna-Generative' }, "System configuration error. Connection string missing.");
      } else {
        try {
          const client = new CosmosClient(connectionString);
          const database = client.database(config.cosmos.database);
          const container = database.container(config.cosmos.containers.incidents);

          log(`Reading item ${incidentId} from container: ${config.cosmos.containers.incidents}`);
          const { resource: existing } = await container.item(incidentId, incidentId).read();
          
          if (existing) {
            if (!existing.acknowledgedAt) {
              const updated = {
                ...existing,
                status: "acknowledged",
                acknowledgedAt: new Date().toISOString(),
                acknowledgedVia: "voice",
                updatedAt: new Date().toISOString()
              };
              
              log(`Replacing item: ${incidentId}`);
              await container.item(incidentId, incidentId).replace(updated);
              log(`Incident ${incidentId} successfully acknowledged via voice`);
              
              response.say({ voice: 'Polly.Joanna-Generative' }, "Thank you. The incident has been acknowledged. Goodbye.");
            } else {
              log(`Incident ${incidentId} was already acknowledged`);
              response.say({ voice: 'Polly.Joanna-Generative' }, "This incident has already been acknowledged. Thank you, goodbye.");
            }
          } else {
            log(`Incident not found: ${incidentId}`, 'warn');
            response.say({ voice: 'Polly.Joanna-Generative' }, "I'm sorry, I couldn't find that incident in our records.");
          }
        } catch (dbError) {
          log(`Database error: ${dbError.message}`, 'error');
          response.say({ voice: 'Polly.Joanna-Generative' }, "There was a database error while acknowledging the incident. Please use the dashboard.");
        }
      }
    } else if (digits && digits !== "1") {
      log(`Received unexpected digits: ${digits}`);
      response.say({ voice: 'Polly.Joanna-Generative' }, `You pressed ${digits}. Please try again or check the dashboard.`);
    } else {
      // This might be the initial prompt or a fallback if something is missing
      log("No valid digits or incidentId found in request");
      const message = req.query.message || "Beacon Alert System";
      response.say({ voice: 'Polly.Joanna-Generative' }, message);
      response.pause({ length: 1 });
      response.say({ voice: 'Polly.Joanna-Generative' }, "Please refer to the dashboard for more details. Goodbye.");
    }
    
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: response.toString()
    };
  } catch (error) {
    log(`Top-level error: ${error.message}`, 'error');
    const errorResponse = new VoiceResponse();
    errorResponse.say({ voice: 'Polly.Joanna-Generative' }, "We're sorry, an internal error occurred while processing this call.");
    
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: errorResponse.toString()
    };
  }
};
