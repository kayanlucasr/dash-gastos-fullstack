const express = require("express");
const router = express.Router();

const {
  createTransaction,
  getTransactions,
  deleteTransaction,
  updateTransaction
} = require("../controllers/transaction.controller");


router.post("/", createTransaction);
router.get("/", getTransactions);
router.delete("/:id", deleteTransaction);
router.put("/:id", updateTransaction);

module.exports = router;
