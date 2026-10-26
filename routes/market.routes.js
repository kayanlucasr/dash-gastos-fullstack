const router = require('express').Router();
const market = require('../services/market');
router.get('/', async (req, res) => {
  res.json(await market.read(req.query.code, req.query.days));
  market.syncAll().catch(() => {});
});
module.exports = router;
