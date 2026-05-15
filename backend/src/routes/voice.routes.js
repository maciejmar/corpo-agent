const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');
const { transcribeBuffer } = require('../services/stt.service');
const { parseVoiceIntent } = require('../services/llm.service');
const { search } = require('../services/qdrant.service');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    const sessionId = uuidv4();
    let transcript = req.body.transcript || '';
    let sttCost = 0;

    // STT if audio file provided
    if (req.file) {
      const sttResult = await transcribeBuffer(req.file.buffer, req.file.originalname || 'audio.webm');
      transcript = sttResult.transcript;
      sttCost = sttResult.costUsd;
    }

    if (!transcript) return res.status(400).json({ error: 'No transcript or audio provided' });

    // Get current cash flow context for budget checks
    const cfResult = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) AS balance
      FROM cashflow WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const cashflowSummary = { balance: parseFloat(cfResult.rows[0].balance) };

    // Parse intent with LLM
    const intent = await parseVoiceIntent(transcript, cashflowSummary);
    let actionResult = null;
    let budgetWarning = null;

    // Execute action
    if (intent.action === 'create_task' && intent.data?.title) {
      const taskData = intent.data;

      // Budget check before creating
      if (taskData.requires_budget && taskData.budget_amount > cashflowSummary.balance) {
        const nextInvoice = await query(`
          SELECT title, amount, due_date FROM financial_docs
          WHERE type='invoice' AND status='pending' AND due_date >= CURRENT_DATE
          ORDER BY due_date LIMIT 1
        `);
        budgetWarning = nextInvoice.rows.length
          ? `Uwaga: niewystarczające środki. Możesz kupić po ${nextInvoice.rows[0].due_date} gdy wpłynie faktura (${nextInvoice.rows[0].amount} PLN).`
          : `Uwaga: niewystarczające środki (saldo: ${cashflowSummary.balance.toFixed(2)} PLN).`;
      }

      const newTask = await query(
        `INSERT INTO tasks (id,title,description,priority,deadline,client,requires_budget,budget_amount,tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [uuidv4(), taskData.title, taskData.description || null, taskData.priority || 'medium',
         taskData.deadline || null, taskData.client || null,
         taskData.requires_budget || false, taskData.budget_amount || 0, '[]']
      );
      actionResult = { type: 'task_created', data: newTask.rows[0] };
    }

    // Save session
    const totalCost = sttCost + (intent.costUsd || 0);
    await query(
      `INSERT INTO voice_sessions (id,transcript,intent,response,cost_usd) VALUES ($1,$2,$3,$4,$5)`,
      [sessionId, transcript, intent.action, intent.message, totalCost]
    );

    res.json({
      sessionId,
      transcript,
      intent: intent.action,
      message: intent.message,
      budgetWarning,
      actionResult,
      costs: { stt_usd: sttCost, llm_usd: intent.costUsd || 0, total_usd: totalCost },
    });
  } catch (err) {
    console.error('Voice process error:', err);
    res.status(500).json({ error: err.message });
  }
});

// RAG voice query
router.post('/query', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript required' });

    const { chat } = require('../services/llm.service');
    let context = '';

    if (process.env.OPENAI_API_KEY) {
      const results = await search(transcript, 5);
      context = results.map(r => r.text).join('\n---\n');
    }

    const response = await chat([{ role: 'user', content: transcript }], context);

    res.json({ answer: response.content, costUsd: response.costUsd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
