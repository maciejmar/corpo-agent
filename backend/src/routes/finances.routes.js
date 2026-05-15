const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');
const { upsertDocument } = require('../services/qdrant.service');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Financial documents
router.get('/docs', async (req, res) => {
  try {
    const { type, status, client } = req.query;
    let sql = 'SELECT * FROM financial_docs WHERE 1=1';
    const params = [];
    let i = 1;
    if (type)   { sql += ` AND type = $${i++}`;         params.push(type); }
    if (status) { sql += ` AND status = $${i++}`;       params.push(status); }
    if (client) { sql += ` AND client ILIKE $${i++}`;   params.push(`%${client}%`); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/docs', upload.single('file'), async (req, res) => {
  try {
    const { title, type = 'invoice', amount, currency = 'PLN', client, due_date, status = 'pending', content } = req.body;
    if (!title || !amount) return res.status(400).json({ error: 'title and amount are required' });

    const id = uuidv4();
    let docContent = content || '';

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(req.file.buffer);
        docContent = data.text;
      } else {
        docContent = req.file.buffer.toString('utf8');
      }
    }

    const result = await query(
      `INSERT INTO financial_docs (id,title,type,amount,currency,client,due_date,status,content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, title, type, parseFloat(amount), currency, client, due_date || null, status, docContent]
    );

    // Index in Qdrant if content available
    if (docContent && process.env.OPENAI_API_KEY) {
      upsertDocument(id, `${title}\n${docContent}`, { type: 'financial_doc', doc_type: type, client, amount, status }).catch(console.error);
    }

    // Auto-create cashflow entry for paid invoices
    if (status === 'paid' && type === 'invoice') {
      await query(
        `INSERT INTO cashflow (id,type,amount,currency,description,date,financial_doc_id)
         VALUES ($1,'income',$2,$3,$4,CURRENT_DATE,$5)`,
        [uuidv4(), parseFloat(amount), currency, `Faktura: ${title}`, id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/docs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await query(
      'UPDATE financial_docs SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (status === 'paid' && doc.type === 'invoice') {
      await query(
        `INSERT INTO cashflow (id,type,amount,currency,description,date,financial_doc_id)
         VALUES ($1,'income',$2,$3,$4,CURRENT_DATE,$5)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), doc.amount, doc.currency, `Faktura opłacona: ${doc.title}`, doc.id]
      );
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cash flow
router.get('/cashflow', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await query(
      `SELECT * FROM cashflow WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days' ORDER BY date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cashflow', async (req, res) => {
  try {
    const { type, amount, currency = 'PLN', description, date } = req.body;
    if (!type || !amount || !date) return res.status(400).json({ error: 'type, amount and date required' });
    const result = await query(
      `INSERT INTO cashflow (id,type,amount,currency,description,date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [uuidv4(), type, parseFloat(amount), currency, description, date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cashflow/summary', async (req, res) => {
  try {
    const summary = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS total_expense,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) AS balance
      FROM cashflow WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const overdue = await query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
      FROM financial_docs WHERE status='pending' AND due_date < CURRENT_DATE
    `);
    res.json({
      ...summary.rows[0],
      overdue_invoices: parseInt(overdue.rows[0].count),
      overdue_amount: parseFloat(overdue.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
