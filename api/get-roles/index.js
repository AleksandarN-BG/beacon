const auth = require("../shared/auth");

module.exports = async function (context, req) {
  try {
    const user = await auth.getUser(context, req);

    if (!user) {
      context.res = {
        status: 200,
        body: { roles: [] }
      };
      return;
    }

    context.res = {
      status: 200,
      body: { roles: user.roles }
    };
  } catch (error) {
    context.log.error(`Error in get-roles: ${error.message}`);
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

