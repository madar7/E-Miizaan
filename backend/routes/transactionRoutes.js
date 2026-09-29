const express = require("express");
const {
  createTransaction,
  getTransactions,
  getSummary,
  getMonthlySummary,
  getDashboard,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/summary", getSummary);
router.get("/summary/monthly", getMonthlySummary);
router.get("/dashboard", getDashboard);
router.route("/").get(getTransactions).post(createTransaction);
router.route("/:id").get(getTransaction).put(updateTransaction).delete(deleteTransaction);

module.exports = router;
