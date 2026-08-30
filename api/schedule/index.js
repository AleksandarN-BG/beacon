const { v4: uuidv4 } = require("uuid");
const auth = require("../shared/auth");
const cosmos = require("../shared/cosmos");

module.exports = async function (context, req) {
  try {
    const currentUser = await auth.getUser(context, req);

    if (!currentUser) {
      context.res = { status: 401, body: { error: "Authentication required" } };
      return;
    }

    const isAdmin = currentUser.roles.includes("admin");

    const scheduleContainer = cosmos.container("schedule");
    const usersContainer = cosmos.container("users");
    if (!scheduleContainer || !usersContainer) {
      context.res = { status: 503, body: { error: "Database not configured" } };
      return;
    }

    const method = req.method.toUpperCase();

    switch (method) {
      case "GET": {
        const { resources: shifts } = await scheduleContainer.items.query("SELECT * FROM c ORDER BY c.startTime ASC").fetchAll();
        const { resources: users } = await usersContainer.items.query("SELECT c.id, c.name, c.phone FROM c").fetchAll();
        const userMap = new Map(users.map(u => [u.id, u]));
        const populatedShifts = shifts.map(shift => ({
          ...shift,
          name: userMap.get(shift.userId)?.name || "Unknown User",
          phone: userMap.get(shift.userId)?.phone || "No Phone",
        }));
        context.res = { status: 200, body: { schedule: populatedShifts } };
        break;
      }

      case "POST": {
        const { userId, startTime, endTime } = req.body;

        if (!userId || !startTime || !endTime) {
          context.res = { status: 400, body: { error: "Missing required fields: userId, startTime, endTime" } };
          return;
        }

        if (!isAdmin && userId !== currentUser.id) {
          context.res = { status: 403, body: { error: "Engineers can only create shifts for themselves" } };
          return;
        }

        const newShift = {
          id: uuidv4(),
          userId,
          startTime,
          endTime,
          createdAt: new Date().toISOString(),
        };

        const { resource: created } = await scheduleContainer.items.create(newShift);
        context.res = { status: 201, body: created };
        break;
      }

      case "DELETE": {
        const deleteId = req.query.id;
        if (!deleteId) {
          context.res = { status: 400, body: { error: "Missing shift id" } };
          return;
        }

        const { resource: shift } = await scheduleContainer.item(deleteId, deleteId).read();

        if (!shift) {
          context.res = { status: 404, body: { error: "Shift not found" } };
          return;
        }

        if (!isAdmin && shift.userId !== currentUser.id) {
          context.res = { status: 403, body: { error: "Engineers can only delete their own shifts" } };
          return;
        }

        await scheduleContainer.item(deleteId, deleteId).delete();
        context.res = { status: 200, body: { success: true, deleted: deleteId } };
        break;
      }

      default:
        context.res = { status: 405, body: { error: "Method not allowed" } };
    }
  } catch (error) {
    context.res = { status: 500, body: { error: error.message } };
  }
};
