const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');
const { upsertDocument } = require('../services/qdrant.service');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/docs', async (req, res) => {
  try {
    const { type, status, client } = req.query;
    let sql = 'SELECT * FROM financial_docs WHERE user_id = $1';
    const params = [req.user.id];
    let i = 2;
    if (type)   { sql += ` AND type = $${i++}`;       params.push(type); }
    if (status) { sql += ` AND status = $${i++}`;     params.push(status); }
    if (client) { sql += ` AND client ILIKE $${i++}`; params.push(`%${client}%`); }
    sql += ' ORDER BY created_at DESC';
    res.json((await query(sql, params)).rows);
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
      `INSERT INTO financial_docs (id,user_id,title,type,amount,currency,client,due_date,status,content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, req.user.id, title, type, parseFloat(amount), currency, client, due_date || null, status, docContent]
    );

    if (docContent && process.env.OPENAI_API_KEY) {
      upsertDocument(id, `${title}\n${docContent}`, { type: 'financial_doc', doc_type: type, client, amount, status }).catch(console.error);
    }

    if (status === 'paid' && type === 'invoice') {
      await query(
        `INSERT INTO cashflow (id,user_id,type,amount,currency,description,date,financial_doc_id)
         VALUES ($1,$2,'income',$3,$4,$5,CURRENT_DATE,$6)`,
        [uuidv4(), req.user.id, parseFloat(amount), currency, `Faktura: ${title}`, id]
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
      'UPDATE financial_docs SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [status, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (status === 'paid' && doc.type === 'invoice') {
      await query(
        `INSERT INTO cashflow (id,user_id,type,amount,currency,description,date,financial_doc_id)
         VALUES ($1,$2,'income',$3,$4,$5,CURRENT_DATE,$6) ON CONFLICT DO NOTHING`,
        [uuidv4(), req.user.id, doc.amount, doc.currency, `Faktura opłacona: ${doc.title}`, doc.id]
      );
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cashflow', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await query(
      `SELECT * FROM cashflow WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days' ORDER BY date DESC`,
      [req.user.id]
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
      `INSERT INTO cashflow (id,user_id,type,amount,currency,description,date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uuidv4(), req.user.id, type, parseFloat(amount), currency, description, date]
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
      FROM cashflow WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
    `, [req.user.id]);
    const overdue = await query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
      FROM financial_docs WHERE user_id = $1 AND status='pending' AND due_date < CURRENT_DATE
    `, [req.user.id]);
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
