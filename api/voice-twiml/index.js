const { CosmosClient } = require("@azure/cosmos");
const qs = require("querystring");
const twilio = require("twilio");
const config = require("../shared/config");

module.exports = async function (context, req) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  try {
    let body = {};
    if (req.body) {
      if (typeof req.body === "string") {
        body = qs.parse(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        body = qs.parse(req.body.toString());
      } else {
        body = req.body;
      }
    }

    const incidentId = req.query.incidentId || body.incidentId;
    const digits = body.Digits || req.query.Digits;

    context.log(`Voice TwiML request: incidentId=${incidentId}, digits=${digits}`);

    if (digits === "1" && incidentId) {
      // Acknowledge the incident in Cosmos DB
      const connectionString = config.cosmos.connectionString;
      if (connectionString) {
        const client = new CosmosClient(connectionString);
        const database = client.database(config.cosmos.database);
        const container = database.container(config.cosmos.containers.incidents);

        try {
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
              await container.item(incidentId, incidentId).replace(updated);
              context.log(`Incident ${incidentId} acknowledged via voice`);
              
              response.say({ voice: 'Polly.Joanna-Generative' }, "Thank you. The incident has been acknowledged. Goodbye.");
            } else {
              response.say({ voice: 'Polly.Joanna-Generative' }, "Incident already acknowledged. Goodbye.");
            }
          } else {
            context.log.warn(`Incident ${incidentId} not found for voice acknowledgment`);
            response.say({ voice: 'Polly.Joanna-Generative' }, "Incident not found. Goodbye.");
          }
        } catch (dbError) {
          context.log.error(`Database error during voice ack: ${dbError.message}`);
          response.say({ voice: 'Polly.Joanna-Generative' }, "There was an error updating the incident. Please check the dashboard.");
        }
      } else {
        context.log.error("Cosmos connection string missing in voice-twiml");
        response.say({ voice: 'Polly.Joanna-Generative' }, "System configuration error. Please check the dashboard.");
      }
    } else {
      // Default message if no digits or different digits
      const message = req.query.message || "Alert from Beacon system";
      response.say({ voice: 'Polly.Joanna-Generative' }, message);
      response.pause({ length: 1 });
      response.say({ voice: 'Polly.Joanna-Generative' }, "This is an automated alert from Beacon. Please check the dashboard for more information.");
    }
    
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: response.toString()
    };
  } catch (error) {
    context.log.error(`Error generating TwiML: ${error.message}`);
    const errorResponse = new VoiceResponse();
    errorResponse.say({ voice: 'Polly.Joanna-Generative' }, "Sorry, there was an error processing your call.");
    
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: errorResponse.toString()
    };
  }
};
