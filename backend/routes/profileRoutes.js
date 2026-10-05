const express = require("express");
const {
  getProfile,
  updateProfile,
  changePassword,
  uploadProfileImage,
  removeProfileImage,
  deactivateOwnAccount,
} = require("../controllers/profileController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getProfile);
router.patch("/", updateProfile);
router.patch("/password", changePassword);
router.post("/image", uploadProfileImage);
router.delete("/image", removeProfileImage);
router.patch("/deactivate", deactivateOwnAccount);

module.exports = router;
