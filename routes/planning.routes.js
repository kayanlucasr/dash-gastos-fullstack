const router = require('express').Router();
const planning = require('../services/planning');
router.get('/', (req,res) => res.json(planning.list()));
router.post('/', (req,res) => res.status(201).json(planning.create(req.body)));
router.put('/:id', (req,res) => res.json(planning.update(req.params.id,req.body)));
router.delete('/:id', (req,res) => res.json(planning.remove(req.params.id)));
module.exports = router;
