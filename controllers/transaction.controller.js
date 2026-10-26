const finance = require('../services/finance');
const createTransaction = async (req, res) => res.status(201).json(await finance.save(req.body));
const updateTransaction = async (req, res) => res.json(await finance.save(req.body, req.params.id));
const deleteTransaction = async (req, res) => res.json(await finance.cancel(req.params.id));
const getTransactions = async (req, res) => res.json(await finance.statement(req.query));
module.exports = {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions
};
