const AuditLog = require("../models/AuditLog");

// Fire-and-forget: an audit-log failure must never break the user's actual
// request, so this only logs to the console if the write itself fails.
async function record(userId, action, { targetType, targetId, meta } = {}) {
  try {
    await AuditLog.create({ user: userId, action, targetType, targetId, meta });
  } catch (err) {
    console.error("Audit log write failed:", action, err.message);
  }
}

module.exports = { record };
