const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, priority, client } = req.query;
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    let i = 1;
    if (status)   { sql += ` AND status = $${i++}`;   params.push(status); }
    if (priority) { sql += ` AND priority = $${i++}`; params.push(priority); }
    if (client)   { sql += ` AND client ILIKE $${i++}`; params.push(`%${client}%`); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, status = 'todo', priority = 'medium', client, deadline, requires_budget = false, budget_amount = 0, tags = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = await query(
      `INSERT INTO tasks (id,title,description,status,priority,client,deadline,requires_budget,budget_amount,tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [uuidv4(), title, description, status, priority, client, deadline || null, requires_budget, budget_amount, JSON.stringify(tags)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const fields = ['title','description','status','priority','client','deadline','requires_budget','budget_amount','tags'];
    const updates = [];
    const params = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${i++}`);
        params.push(f === 'tags' ? JSON.stringify(req.body[f]) : req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const result = await query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Budget check against cash flow
router.get('/:id/budget-check', async (req, res) => {
  try {
    const task = (await query('SELECT * FROM tasks WHERE id = $1', [req.params.id])).rows[0];
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (!task.requires_budget) return res.json({ ok: true, message: 'Zadanie nie wymaga budżetu.' });

    const cf = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
      FROM cashflow WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const balance = parseFloat(cf.rows[0].income) - parseFloat(cf.rows[0].expense);
    const needed = parseFloat(task.budget_amount);

    if (balance >= needed) {
      return res.json({ ok: true, balance, needed, message: 'Możesz zrealizować to zadanie — środki dostępne.' });
    }

    const nextInvoice = await query(`
      SELECT title, amount, due_date FROM financial_docs
      WHERE type='invoice' AND status='pending' AND due_date >= CURRENT_DATE
      ORDER BY due_date LIMIT 1
    `);

    const hint = nextInvoice.rows.length
      ? `Możesz kupić po ${nextInvoice.rows[0].due_date}, gdy wpłynie faktura od "${nextInvoice.rows[0].title}" (${nextInvoice.rows[0].amount} PLN).`
      : `Niewystarczające środki. Bieżące saldo: ${balance.toFixed(2)} PLN, wymagane: ${needed} PLN.`;

    res.json({ ok: false, balance, needed, message: hint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
