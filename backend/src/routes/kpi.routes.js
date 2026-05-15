const express = require('express');
const { query } = require('../db/database');
const { generateKpiAnalysis } = require('../services/llm.service');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [tasks, docs, cashflow] = await Promise.all([
      query('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100'),
      query('SELECT * FROM financial_docs ORDER BY created_at DESC LIMIT 50'),
      query('SELECT * FROM cashflow WHERE date >= CURRENT_DATE - INTERVAL \'90 days\' ORDER BY date DESC'),
    ]);

    // Static KPIs (fast, no LLM cost)
    const taskRows = tasks.rows;
    const docRows = docs.rows;
    const cfRows = cashflow.rows;

    const total = taskRows.length;
    const done = taskRows.filter(t => t.status === 'done').length;
    const overdue = taskRows.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done').length;

    const pendingInvoices = docRows.filter(d => d.type === 'invoice' && d.status === 'pending');
    const overdueInvoices = pendingInvoices.filter(d => d.due_date && new Date(d.due_date) < new Date());
    const totalPending = pendingInvoices.reduce((s, d) => s + parseFloat(d.amount), 0);

    const income = cfRows.filter(c => c.type === 'income').reduce((s, c) => s + parseFloat(c.amount), 0);
    const expense = cfRows.filter(c => c.type === 'expense').reduce((s, c) => s + parseFloat(c.amount), 0);

    res.json({
      task_completion_rate: total > 0 ? Math.round((done / total) * 100) : 0,
      total_tasks: total,
      done_tasks: done,
      overdue_tasks: overdue,
      pending_invoices: pendingInvoices.length,
      overdue_invoices: overdueInvoices.length,
      pending_invoices_total: totalPending,
      monthly_income: income,
      monthly_expenses: expense,
      net_cashflow: income - expense,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI-powered deep analysis (costs LLM tokens)
router.post('/analyze', async (req, res) => {
  try {
    const [tasks, docs, cashflow] = await Promise.all([
      query('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100'),
      query('SELECT * FROM financial_docs ORDER BY created_at DESC LIMIT 50'),
      query('SELECT * FROM cashflow ORDER BY date DESC LIMIT 90'),
    ]);
    const analysis = await generateKpiAnalysis(tasks.rows, docs.rows, cashflow.rows);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
