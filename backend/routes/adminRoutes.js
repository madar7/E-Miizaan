const express = require("express");
const {
  listUsers,
  exportUsers,
  getUser,
  updateUser,
  deleteUser,
  listAuditLogs,
  exportAuditLogs,
  approveUser,
  rejectUser,
  getOverview,
} = require("../controllers/adminController");
const { getSystemSettings, updateSystemSettings } = require("../controllers/systemSettingsController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/overview", getOverview);

// NOTE: /users/export must be registered before /users/:id, or Express
// would match "export" as the :id param.
router.get("/users/export", exportUsers);
router.get("/users", listUsers);
router.get("/users/:id", getUser);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/approve", approveUser);
router.patch("/users/:id/reject", rejectUser);
router.delete("/users/:id", deleteUser);

router.get("/audit-logs/export", exportAuditLogs);
router.get("/audit-logs", listAuditLogs);

router.get("/settings", getSystemSettings);
router.patch("/settings", updateSystemSettings);

module.exports = router;
