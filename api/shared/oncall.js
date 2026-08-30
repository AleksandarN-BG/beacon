/*
 * Who is on call right now.
 *
 * The same schedule query was written out in three places (incidents,
 * voice-twiml, and the alert endpoints resolved it not at all). It is the only
 * thing allowed to decide which number gets paged: taking that from a request
 * body let any caller name any destination.
 */
const cosmos = require("./cosmos");

/**
 * The engineer whose shift covers this moment.
 *
 * @returns {Promise<{userId: string, name: string, phone: string|null}|null>}
 *          null when nobody is scheduled, or the database is unavailable.
 */
async function currentOnCall(context) {
  const schedule = cosmos.container("schedule");
  const users = cosmos.container("users");
  if (!schedule || !users) return null;

  const now = new Date().toISOString();

  const { resources: shifts } = await schedule.items
    .query({
      query: "SELECT * FROM c WHERE c.startTime <= @now AND c.endTime >= @now",
      parameters: [{ name: "@now", value: now }],
    })
    .fetchAll();

  if (shifts.length === 0) {
    context.log.warn("[OnCall] Nobody is currently scheduled");
    return null;
  }

  const shift = shifts[0];

  // The shift only stores a user id; name and number live on the user record,
  // so they stay correct when someone changes their phone number.
  let name = shift.name || null;
  let phone = shift.phone || null;

  try {
    const { resource: user } = await users.item(shift.userId, shift.userId).read();
    if (user) {
      name = user.name || name;
      phone = user.phone || phone;
    }
  } catch (err) {
    context.log.warn(`[OnCall] Could not read user ${shift.userId}: ${err.message}`);
  }

  return { userId: shift.userId, name: name || "Engineer", phone };
}

module.exports = { currentOnCall };
