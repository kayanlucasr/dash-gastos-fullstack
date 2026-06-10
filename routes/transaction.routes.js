const express = require("express");
const router = express.Router();

const {
  createTransaction,
  getTransactions,
  deleteTransaction,
  updateTransaction
} = require("../controllers/transaction.controller");

const authMiddleware = require("../middlewares/auth.middleware");

router.post("/", authMiddleware, createTransaction);
router.get("/", authMiddleware, getTransactions);
router.delete("/:id", authMiddleware, deleteTransaction);
router.put("/:id", authMiddleware, updateTransaction);

module.exports = router;