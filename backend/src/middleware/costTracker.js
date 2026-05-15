const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');

// Pricing in USD per unit
const PRICING = {
  llm: {
    input_per_token: 3.00 / 1_000_000,    // Claude Sonnet 4.6
    output_per_token: 15.00 / 1_000_000,
    cached_input_per_token: 0.30 / 1_000_000,
  },
  stt: { per_minute: 0.006 },              // OpenAI Whisper
  tts: { per_char: 0.000015 },             // ElevenLabs estimate
};

function calcLlmCost(inputTokens, outputTokens, cachedTokens = 0) {
  return (
    inputTokens * PRICING.llm.input_per_token +
    outputTokens * PRICING.llm.output_per_token +
    cachedTokens * PRICING.llm.cached_input_per_token
  );
}

async function logCost({ service, operation, tokensInput = 0, tokensOutput = 0, gpuSeconds = 0, costUsd, sessionId }) {
  await query(
    `INSERT INTO cost_logs (id, service, operation, tokens_input, tokens_output, gpu_seconds, cost_usd, session_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uuidv4(), service, operation, tokensInput, tokensOutput, gpuSeconds, costUsd, sessionId || null]
  );
}

async function getTotalCosts() {
  const [total, byService, today, thisMonth, recent] = await Promise.all([
    query('SELECT COALESCE(SUM(cost_usd),0) AS total FROM cost_logs'),
    query('SELECT service, COALESCE(SUM(cost_usd),0) AS cost, COUNT(*) AS calls FROM cost_logs GROUP BY service'),
    query("SELECT COALESCE(SUM(cost_usd),0) AS total FROM cost_logs WHERE timestamp::date = CURRENT_DATE"),
    query("SELECT COALESCE(SUM(cost_usd),0) AS total FROM cost_logs WHERE date_trunc('month', timestamp) = date_trunc('month', NOW())"),
    query('SELECT * FROM cost_logs ORDER BY timestamp DESC LIMIT 20'),
  ]);

  return {
    total_usd: parseFloat(total.rows[0].total),
    today_usd: parseFloat(today.rows[0].total),
    this_month_usd: parseFloat(thisMonth.rows[0].total),
    by_service: byService.rows.map(r => ({ ...r, cost: parseFloat(r.cost) })),
    recent: recent.rows,
    pricing: PRICING,
  };
}

module.exports = { logCost, calcLlmCost, getTotalCosts, PRICING };
