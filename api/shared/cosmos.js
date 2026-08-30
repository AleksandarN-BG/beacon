/*
 * One Cosmos client for the whole Function App.
 *
 * Every handler used to call `new CosmosClient(...)` inside its own request
 * path -- nine sites across eight files. Each client opens its own connection
 * pool, and in Functions the host keeps an instance warm across many requests,
 * so that pattern accumulates sockets until the instance starts refusing
 * connections. Creating it once at module scope means the pool is shared and
 * reused for the life of the worker.
 *
 * Construction is lazy rather than at require time: the connection string comes
 * from application settings, and a module that throws on import takes the whole
 * function down with an unhelpful error.
 */
const { CosmosClient } = require("@azure/cosmos");
const config = require("./config");

let client = null;

/** True when a connection string is configured at all. */
function isConfigured() {
  return Boolean(config.cosmos.connectionString);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    client = new CosmosClient(config.cosmos.connectionString);
  }
  return client;
}

/**
 * A container by its logical name -- one of the keys of config.cosmos.containers
 * ("users", "incidents", "schedule", "monitors", "logs").
 *
 * Returns null when the database is not configured, so callers can degrade
 * instead of throwing.
 */
function container(name) {
  const id = config.cosmos.containers[name];
  if (!id) throw new Error(`Unknown Cosmos container: ${name}`);

  const c = getClient();
  if (!c) return null;

  return c.database(config.cosmos.database).container(id);
}

module.exports = { container, isConfigured };
