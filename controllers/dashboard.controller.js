const finance = require('../services/finance');
const getDashboard = async (req, res) => res.json(await finance.dashboard(req.query.month));
const getExpensesByCategory = async (req, res) => res.json((await finance.dashboard(req.query.month)).categories);
module.exports = {
  getDashboard,
  getExpensesByCategory
};
