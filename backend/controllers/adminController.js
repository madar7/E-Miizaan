const User = require("../models/User");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { escapeRegex } = require("../utils/regex");
const audit = require("../services/auditService");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/admin/users?search=&role=&approvalStatus=&page=&limit=
const listUsers = asyncHandler(async (req, res) => {
  const { search, role, approvalStatus } = req.query;
  const filter = {};
  if (role && ["user", "admin"].includes(role)) filter.role = role;
  if (approvalStatus && ["approved", "pending", "rejected"].includes(approvalStatus)) filter.approvalStatus = approvalStatus;
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { username: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
    ];
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate("createdBy", "name username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const counts = await Transaction.aggregate([{ $group: { _id: "$user", count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  const withCounts = users.map((u) => {
    const obj = u.toJSON();
    obj.transactionCount = countMap[String(u._id)] || 0;
    return obj;
  });

  return success(res, {
    data: { users: withCounts, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } },
  });
});

// GET /api/admin/users/export — same filters as listUsers, no pagination (a full export)
const exportUsers = asyncHandler(async (req, res) => {
  const { search, role, approvalStatus } = req.query;
  const filter = {};
  if (role && ["user", "admin"].includes(role)) filter.role = role;
  if (approvalStatus && ["approved", "pending", "rejected"].includes(approvalStatus)) filter.approvalStatus = approvalStatus;
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { username: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
    ];
  }

  const users = await User.find(filter).sort({ createdAt: -1 });

  const header = ["Name", "Username", "Email", "Account Type", "Role", "Status", "Approval", "Joined"];
  const escapeCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = users.map((u) => [
    u.name, u.username || "", u.email, u.accountType, u.role,
    u.isActive ? "Active" : "Deactivated", u.approvalStatus,
    new Date(u.createdAt).toISOString().slice(0, 10),
  ]);
  const csv = [header, ...rows].map((r) => r.map(escapeCell).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="e-miizaan-users.csv"');
  res.send(csv);
});

// GET /api/admin/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return fail(res, { status: 404, message: "User not found" });
  return success(res, { data: user });
});

// PATCH /api/admin/users/:id  { role?, isActive?, name?, email?, phone?, country? }
const updateUser = asyncHandler(async (req, res) => {
  const { role, isActive, name, email, phone, country } = req.body;

  if (String(req.params.id) === String(req.user._id)) {
    if (isActive === false) return fail(res, { status: 400, message: "You cannot deactivate your own account" });
    if (role && role !== "admin") return fail(res, { status: 400, message: "You cannot remove your own admin access" });
  }

  const update = {};
  if (role !== undefined) {
    if (!["user", "admin"].includes(role)) return fail(res, { status: 400, message: "Role must be 'user' or 'admin'" });
    update.role = role;
  }
  if (isActive !== undefined) update.isActive = Boolean(isActive);

  if (name !== undefined) {
    if (!String(name).trim()) return fail(res, { status: 400, message: "Name cannot be empty" });
    update.name = String(name).trim();
  }
  if (phone !== undefined) update.phone = String(phone).trim();
  if (country !== undefined) update.country = String(country).trim();
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) return fail(res, { status: 400, message: "Enter a valid email address" });
    const dup = await User.findOne({ email: normalized, _id: { $ne: req.params.id } });
    if (dup) return fail(res, { status: 409, message: "Another account already uses this email" });
    update.email = normalized;
  }

  const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
  if (!user) return fail(res, { status: 404, message: "User not found" });

  if (role !== undefined) {
    await audit.record(req.user._id, "user.role_change", { targetType: "User", targetId: user._id, meta: { role } });
  }
  if (isActive !== undefined) {
    await audit.record(req.user._id, "user.status_change", { targetType: "User", targetId: user._id, meta: { isActive } });
  }
  if (name !== undefined || email !== undefined || phone !== undefined || country !== undefined) {
    await audit.record(req.user._id, "user.updated", { targetType: "User", targetId: user._id, meta: { fields: Object.keys(update).filter((k) => !["role", "isActive"].includes(k)) } });
  }

  return success(res, { message: "User updated successfully", data: user });
});

// PATCH /api/admin/users/:id/approve
const approveUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { approvalStatus: "approved" } }, { new: true });
  if (!user) return fail(res, { status: 404, message: "User not found" });
  await audit.record(req.user._id, "user.approved", { targetType: "User", targetId: user._id });
  return success(res, { message: "User approved", data: user });
});

// PATCH /api/admin/users/:id/reject
const rejectUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { approvalStatus: "rejected", isActive: false } }, { new: true });
  if (!user) return fail(res, { status: 404, message: "User not found" });
  await audit.record(req.user._id, "user.rejected", { targetType: "User", targetId: user._id });
  return success(res, { message: "User rejected", data: user });
});

// DELETE /api/admin/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return fail(res, { status: 400, message: "You cannot delete your own account" });
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return fail(res, { status: 404, message: "User not found" });

  await Transaction.deleteMany({ user: user._id });
  await audit.record(req.user._id, "user.delete", { targetType: "User", targetId: user._id, meta: { email: user.email } });

  return success(res, { message: "User and their transactions were deleted" });
});

// GET /api/admin/audit-logs?page=&limit=&action=&userId=
const listAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.userId) filter.user = req.query.userId;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("user", "name username email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return success(res, { data: { logs, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } } });
});

// GET /api/admin/audit-logs/export — same filters, no pagination
const exportAuditLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.userId) filter.user = req.query.userId;

  const logs = await AuditLog.find(filter).populate("user", "name username email").sort({ createdAt: -1 }).limit(5000);

  const header = ["When", "User", "Action", "Target Type", "Target ID"];
  const escapeCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map((l) => [
    new Date(l.createdAt).toISOString(),
    l.user ? `${l.user.name} (${l.user.username || l.user.email})` : "Deleted user",
    l.action, l.targetType || "", l.targetId || "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(escapeCell).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="e-miizaan-audit-log.csv"');
  res.send(csv);
});

// GET /api/admin/overview — system-wide stats for the admin dashboard
const getOverview = asyncHandler(async (req, res) => {
  const [usersByRole, usersByStatus, usersByApproval, usersByAccountType, totalTxnAgg, recentUsers, pendingCount] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$isActive", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$approvalStatus", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$accountType", count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    User.find().sort({ createdAt: -1 }).limit(5).select("name username email accountType role createdAt"),
    User.countDocuments({ approvalStatus: "pending" }),
  ]);

  const toMap = (rows, keyFn = (r) => String(r._id)) => Object.fromEntries(rows.map((r) => [keyFn(r), r.count]));
  const roleMap = toMap(usersByRole);
  const statusMap = toMap(usersByStatus, (r) => (r._id ? "active" : "inactive"));
  const approvalMap = toMap(usersByApproval);
  const accountTypeMap = toMap(usersByAccountType);

  const txnTotals = { income: 0, expense: 0 };
  let totalTransactions = 0;
  totalTxnAgg.forEach((r) => {
    txnTotals[r._id] = r.total;
    totalTransactions += r.count;
  });

  return success(res, {
    data: {
      users: {
        total: (roleMap.user || 0) + (roleMap.admin || 0),
        admins: roleMap.admin || 0,
        regular: roleMap.user || 0,
        active: statusMap.active || 0,
        inactive: statusMap.inactive || 0,
        pending: approvalMap.pending || 0,
        rejected: approvalMap.rejected || 0,
        individual: accountTypeMap.individual || 0,
        smallBusiness: accountTypeMap.small_business || 0,
      },
      transactions: {
        total: totalTransactions,
        totalIncome: txnTotals.income,
        totalExpense: txnTotals.expense,
        netBalance: txnTotals.income - txnTotals.expense,
      },
      pendingApprovals: pendingCount,
      recentUsers,
    },
  });
});

module.exports = {
  listUsers, exportUsers, getUser, updateUser, deleteUser,
  listAuditLogs, exportAuditLogs, approveUser, rejectUser, getOverview,
};
