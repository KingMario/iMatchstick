var express = require('express');
var router = express.Router();
var solver = require('../solver')
var qs = require('../qs')

router.get('/solve', function(req, res, next) {
  let q = req.query.q
  let s = parseInt(req.query.s) || 1

  if (!/^\d{1,2}[+-]\d{1,2}=\d{1,3}$/.test(q)) {
    return res.json([])
  }
  res.json((s === 1 ? solver.solve(q, s) : qs.solve(q, s)).sort())
})

module.exports = router
