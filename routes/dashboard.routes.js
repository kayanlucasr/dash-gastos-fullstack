const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");

const {
  getDashboard,
  getExpensesByCategory
} = require("../controllers/dashboard.controller");

router.get("/", authMiddleware, getDashboard);
router.get(
  "/categories",
  authMiddleware,
  getExpensesByCategory
);

module.exports = router;