const express = require('express');
const { getTotalCosts } = require('../middleware/costTracker');
const { query } = require('../db/database');
const router = express.Router();

router.get('/total', async (req, res) => {
  try {
    const costs = await getTotalCosts();
    res.json(costs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { limit = 50, service } = req.query;
    let sql = 'SELECT * FROM cost_logs WHERE 1=1';
    const params = [];
    let i = 1;
    if (service) { sql += ` AND service = $${i++}`; params.push(service); }
    sql += ` ORDER BY timestamp DESC LIMIT $${i}`;
    params.push(parseInt(limit));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
