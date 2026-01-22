const { CosmosClient } = require("@azure/cosmos");
const config = require("./config");

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
  const connectionString = config.cosmos.connectionString;
  if (!connectionString) return event;

  try {
    const client = new CosmosClient(connectionString);
    const database = client.database(config.cosmos.database);
    const container = database.container(config.cosmos.containers.logs);
    
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
