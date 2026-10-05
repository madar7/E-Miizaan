const express = require("express");
const { getCreationPolicy, createUser } = require("../controllers/userManagementController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

// Deliberately NOT adminOnly — createUser itself enforces the
// allowUsersToCreateUsers rule and the admin-only-role rule internally.
router.get("/policy", getCreationPolicy);
router.post("/", createUser);

module.exports = router;
