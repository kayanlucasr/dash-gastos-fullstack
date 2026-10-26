const router = require('express').Router();
const finance = require('../services/finance');
router.get('/categories', async (req, res) => res.json(finance.categories()));
router.get('/accounts', async (req, res) => res.json(await finance.accounts()));
router.post('/accounts', async (req, res) => res.status(201).json(await finance.createAccount(req.body)));
router.get('/wealth', async (req, res) => res.json(await finance.wealth()));
router.post('/valuations', async (req, res) => res.status(201).json(await finance.valuation(req.body)));
module.exports = router;
