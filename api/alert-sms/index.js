/*
 * Manually text the on-call engineer -- an operational check that paging works
 * before it is needed for real. Incident-driven alerts do not come through
 * here; they call shared/notify directly.
 *
 * Two things changed from the original. The gate was "any authenticated user",
 * and the identity provider is the `common` Azure AD tenant, so that meant any
 * Microsoft account anywhere. And the destination came from the request body,
 * so a caller chose which number to text on this project's Twilio account.
 * The number is now resolved from the on-call schedule and the caller cannot
 * influence it.
 */
const auth = require("../shared/auth");
const logger = require("../shared/logger");
const notify = require("../shared/notify");
const oncall = require("../shared/oncall");

module.exports = async function (context, req) {
  try {
    const currentUser = await auth.getUser(context, req);
    if (!currentUser) {
      context.res = { status: 401, body: { error: "Authentication required" } };
      return;
    }

    const roles = currentUser.roles || [];
    if (!roles.includes("admin") && !roles.includes("engineer")) {
      await logger.logSystemEvent(
        context,
        "warn",
        `Rejected manual SMS alert from ${currentUser.id} (roles: ${roles.join(", ") || "none"})`,
      );
      context.res = {
        status: 403,
        body: { error: "Permission denied. Only admins and engineers can send alerts." },
      };
      return;
    }

    if (!notify.isConfigured()) {
      await logger.logSystemEvent(context, "error", "Twilio is not configured");
      context.res = { status: 500, body: { error: "Twilio not configured" } };
      return;
    }

    const engineer = await oncall.currentOnCall(context);
    if (!engineer?.phone) {
      context.res = {
        status: 409,
        body: { error: "Nobody is currently on call, or the on-call engineer has no phone number set." },
      };
      return;
    }

    const { service = "Manual test", status } = req.body || {};
    const result = await notify.sendSms(context, { to: engineer.phone, service, status });

    context.res = {
      status: 200,
      body: { success: true, messageId: result.sid, status: result.status, sentTo: engineer.name },
    };
  } catch (error) {
    // The message is safe to return; the stack is not -- it names internal
    // paths and module layout.
    context.log.error(`[AlertSMS] ${error.message}`);
    context.res = { status: 500, body: { error: error.message } };
  }
};
