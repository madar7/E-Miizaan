const express = require("express");
const { getBusiness, updateBusiness } = require("../controllers/businessController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getBusiness);
router.patch("/", updateBusiness);

module.exports = router;
