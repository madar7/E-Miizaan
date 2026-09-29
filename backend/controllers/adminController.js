const User = require("../models/User");
const Transaction = require("../models/Transaction");

// GET /api/admin/users?search=&role=
async function listUsers(req, res) {
  try {
    const { search, role } = req.query;
    const filter = {};
    if (role && ["user", "admin"].includes(role)) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    // Attach a lightweight transaction count per user (nice for the admin table)
    const counts = await Transaction.aggregate([
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

    const withCounts = users.map((u) => {
      const obj = u.toJSON();
      obj.transactionCount = countMap[String(u._id)] || 0;
      return obj;
    });

    res.json({ users: withCounts, total: withCounts.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users", error: err.message });
  }
}

// GET /api/admin/users/:id
async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user", error: err.message });
  }
}

// PATCH /api/admin/users/:id  { role?, isActive? }
async function updateUser(req, res) {
  try {
    const { role, isActive } = req.body;

    if (String(req.params.id) === String(req.user._id)) {
      // Prevent an owner/admin from locking themselves out by accident
      if (isActive === false) {
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }
      if (role && role !== "admin") {
        return res.status(400).json({ message: "You cannot remove your own admin access" });
      }
    }

    const update = {};
    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Role must be 'user' or 'admin'" });
      }
      update.role = role;
    }
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update user", error: err.message });
  }
}

// DELETE /api/admin/users/:id
async function deleteUser(req, res) {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Cascade: remove that user's transactions too
    await Transaction.deleteMany({ user: user._id });

    res.json({ message: "User and their transactions were deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user", error: err.message });
  }
}

module.exports = { listUsers, getUser, updateUser, deleteUser };
