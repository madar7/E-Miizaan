// Standard API envelope used by every endpoint: { success, message, data }.
function success(res, { status = 200, message = "Success", data = null } = {}) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, { status = 500, message = "Something went wrong", errors } = {}) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

module.exports = { success, fail };
