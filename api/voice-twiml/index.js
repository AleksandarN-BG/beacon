const { CosmosClient } = require("@azure/cosmos");
const qs = require("querystring");

module.exports = async function (context, req) {
  try {
    const body = typeof req.body === "string" ? qs.parse(req.body) : (req.body || {});
    const incidentId = req.query.incidentId || body.incidentId;
    const digits = body.Digits || req.query.Digits;

    context.log(`Voice TwiML request: incidentId=${incidentId}, digits=${digits}`);

    let twimlResponse = "";

    if (digits === "1" && incidentId) {
      // Acknowledge the incident in Cosmos DB
      const connectionString = process.env.COSMOS_CONNECTION_STRING;
      if (connectionString) {
        const client = new CosmosClient(connectionString);
        const database = client.database(process.env.COSMOS_DATABASE || "beacon");
        const container = database.container(process.env.COSMOS_CONTAINER_INCIDENTS || "incidents");

        try {
          const { resource: existing } = await container.item(incidentId, incidentId).read();
          if (existing && !existing.acknowledgedAt) {
            const updated = {
              ...existing,
              status: "acknowledged",
              acknowledgedAt: new Date().toISOString(),
              acknowledgedVia: "voice",
              updatedAt: new Date().toISOString()
            };
            await container.item(incidentId, incidentId).replace(updated);
            context.log(`Incident ${incidentId} acknowledged via voice`);
            
            twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Generative">Thank you. The incident has been acknowledged. Goodbye.</Say>
</Response>`;
          } else {
            twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Generative">Incident already acknowledged or not found. Goodbye.</Say>
</Response>`;
          }
        } catch (dbError) {
          context.log.error(`Database error: ${dbError.message}`);
          twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Generative">There was an error updating the incident. Please check the dashboard.</Say>
</Response>`;
        }
      }
    } else {
      // Default message if no digits or different digits
      const message = req.query.message || "Alert from Beacon system";
      twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Generative">${message}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna-Generative">This is an automated alert from Beacon. Please check the dashboard for more information.</Say>
</Response>`;
    }
    
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      },
      body: twimlResponse
    };
  } catch (error) {
    context.log.error(`Error generating TwiML: ${error.message}`);
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Generative">Sorry, there was an error processing your call.</Say>
</Response>`
    };
  }
};
