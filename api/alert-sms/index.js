const { SmsClient } = require("@azure/communication-sms");

module.exports = async function (context, req) {
  try {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    const fromNumber = process.env.ACS_PHONE_NUMBER;

    if (!connectionString || !fromNumber) {
      context.res = {
        status: 500,
        body: { error: "ACS not configured" }
      };
      return;
    }

    const { phone, service, status } = req.body;

    if (!phone || !service) {
      context.res = {
        status: 400,
        body: { error: "Missing required fields: phone, service" }
      };
      return;
    }

    const client = new SmsClient(connectionString);

    const message = status === "up"
      ? `Beacon Alert: ${service} is back UP`
      : `Beacon Alert: ${service} is DOWN`;

    const sendResults = await client.send({
      from: fromNumber,
      to: [phone],
      message: message
    });

    context.res = {
      status: 200,
      body: { success: true, results: sendResults }
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

