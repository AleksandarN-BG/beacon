const auth = require("../shared/auth");
const cosmos = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    // Authenticate user
    const currentUser = await auth.getUser(context, req);
    if (!currentUser) {
      context.res = {
        status: 401,
        body: { error: "Authentication required" }
      };
      return;
    }

    // Optional: restrict to admins/engineers
    const isAdmin = currentUser.roles.includes("admin");
    const isEngineer = currentUser.roles.includes("engineer");
    if (!isAdmin && !isEngineer) {
      context.res = {
        status: 403,
        body: { error: "Permission denied. Only admins and engineers can view logs." }
      };
      return;
    }

    const container = cosmos.container("logs");
    if (!container) {
      context.res = { status: 200, body: { logs: [] } };
      return;
    }

    // Get the last 50 logs, most recent first
    const { resources: logs } = await container.items
      .query("SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT 50")
      .fetchAll();

    context.res = {
      status: 200,
      body: { logs }
    };
  } catch (error) {
    context.log.error(`Error fetching logs: ${error.message}`);
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};
