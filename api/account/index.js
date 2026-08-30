const auth = require("../shared/auth");
const cosmos = require("../shared/cosmos");

module.exports = async function (context, req) {
  const currentUser = await auth.getUser(context, req);
  if (!currentUser) {
    context.res = { status: 401, body: { error: "Authentication required" } };
    return;
  }

  const container = cosmos.container("users");
  if (!container) {
    context.res = { status: 503, body: { error: "Database not configured" } };
    return;
  }

  if (req.method === "GET") {
    const { resource: user } = await container.item(currentUser.id, currentUser.id).read();
    context.res = { status: 200, body: user };
  } else if (req.method === "PUT") {
    const { name, phone } = req.body;
    const { resource: existingUser } = await container.item(currentUser.id, currentUser.id).read();
    const updatedUser = { ...existingUser, name, phone };
    await container.item(currentUser.id, currentUser.id).replace(updatedUser);
    context.res = { status: 200, body: updatedUser };
  }
};
