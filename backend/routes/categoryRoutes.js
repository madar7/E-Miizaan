const express = require("express");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.route("/").get(listCategories).post(createCategory);
router.route("/:id").put(updateCategory).delete(deleteCategory);

module.exports = router;
