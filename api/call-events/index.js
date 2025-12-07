module.exports = async function (context, req) {
  // Handle call automation events (call connected, call ended, etc.)
  const events = req.body;

  context.log("Call event received:", JSON.stringify(events));

  // Process events as needed
  if (Array.isArray(events)) {
    for (const event of events) {
      const eventType = event.type;
      context.log(`Processing event: ${eventType}`);

      // Handle different event types
      switch (eventType) {
        case "Microsoft.Communication.CallConnected":
          context.log("Call connected");
          break;
        case "Microsoft.Communication.CallDisconnected":
          context.log("Call disconnected");
          break;
        case "Microsoft.Communication.PlayCompleted":
          context.log("Audio playback completed");
          break;
        default:
          context.log(`Unhandled event type: ${eventType}`);
      }
    }
  }

  context.res = {
    status: 200,
    body: { received: true }
  };
};

