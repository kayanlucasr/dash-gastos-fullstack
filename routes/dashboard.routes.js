const express = require("express");
const router = express.Router();


const {
  getDashboard,
  getExpensesByCategory
} = require("../controllers/dashboard.controller");

router.get("/", getDashboard);
router.get(
  "/categories",
  getExpensesByCategory
);

module.exports = router;
