/*
 * Manually ring the on-call engineer -- the voice equivalent of alert-sms, and
 * the same reasoning applies: admin or engineer only, and the number comes from
 * the schedule rather than from the caller.
 *
 * See alert-sms for what this replaced.
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
        `Rejected manual escalation call from ${currentUser.id} (roles: ${roles.join(", ") || "none"})`,
      );
      context.res = {
        status: 403,
        body: { error: "Permission denied. Only admins and engineers can place alert calls." },
      };
      return;
    }

    if (!notify.isConfigured()) {
      await logger.logSystemEvent(context, "error", "Twilio is not configured");
      context.res = { status: 500, body: { error: "Twilio not configured" } };
      return;
    }

    // An acknowledgement has to attach to something, so unlike the SMS path
    // this one genuinely needs an incident id from the caller.
    const { service = "Manual test", incidentId } = req.body || {};
    if (!incidentId) {
      context.res = { status: 400, body: { error: "Missing required field: incidentId" } };
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

    const result = await notify.placeCall(context, { to: engineer.phone, service, incidentId });

    context.res = {
      status: 200,
      body: { success: true, callSid: result.sid, calling: engineer.name },
    };
  } catch (error) {
    context.log.error(`[AlertCall] ${error.message}`);
    context.res = { status: 500, body: { error: error.message } };
  }
};
