const { CallAutomationClient } = require("@azure/communication-call-automation");

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

    const { phone, service, callbackUrl } = req.body;

    if (!phone || !service) {
      context.res = {
        status: 400,
        body: { error: "Missing required fields: phone, service" }
      };
      return;
    }

    const client = new CallAutomationClient(connectionString);

    const callResult = await client.createCall(
      {
        targetParticipant: { phoneNumber: phone },
        sourceCallIdNumber: { phoneNumber: fromNumber }
      },
      callbackUrl || `${process.env.WEBSITE_HOSTNAME}/api/call-events`
    );

    context.res = {
      status: 200,
      body: {
        success: true,
        callConnectionId: callResult.callConnectionProperties.callConnectionId
      }
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

