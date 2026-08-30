const cosmos = require("./cosmos");

async function logSystemEvent(context, level, message, details = null) {
  const event = {
    id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    level: level, // info, warn, error
    message: message,
    details: details,
    source: context.executionContext ? context.executionContext.functionName : "unknown"
  };

  // Always log to console/context first
  const formattedMsg = `[SystemLog][${level.toUpperCase()}] ${message}`;
  if (level === 'error') {
    context.log.error(formattedMsg);
    if (details) console.error(details);
  } else if (level === 'warn') {
    context.log.warn(formattedMsg);
  } else {
    context.log(formattedMsg);
  }

  // Try to persist to Cosmos DB
  const container = cosmos.container("logs");
  if (!container) return event;

  try {
    await container.items.create(event);
  } catch (err) {
    // If we fail to log to DB, don't crash the whole thing
    context.log.warn(`Failed to persist system log to Cosmos DB: ${err.message}`);
  }

  return event;
}

module.exports = {
  logSystemEvent
};
