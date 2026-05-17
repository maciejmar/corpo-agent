const Anthropic = require('@anthropic-ai/sdk');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { logCost, calcLlmCost } = require('../middleware/costTracker');

const PROVIDER = process.env.LLM_PROVIDER || 'anthropic';
const MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929';
const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-sonnet-4-5-20250929-v1:0';

const anthropicClient = PROVIDER === 'anthropic'
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const bedrockClient = PROVIDER === 'bedrock'
  ? new BedrockRuntimeClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1' })
  : null;

const SYSTEM_PROMPT = `Jesteś asystentem AI dla firmy. Pomagasz zarządzać zadaniami, finansami i cash flow.

Potrafisz:
- Tworzyć i aktualizować zadania z backlogu
- Analizować faktury i status płatności
- Ostrzegać o ryzyku płynności finansowej
- Odpowiadać na pytania o KPI firmy

Odpowiadaj zawsze po polsku. Bądź zwięzły i precyzyjny.`;

async function createMessage({ max_tokens, system, messages }) {
  if (PROVIDER === 'bedrock') {
    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens,
        system,
        messages,
      }),
    });

    const response = await bedrockClient.send(command);
    return JSON.parse(Buffer.from(response.body).toString('utf8'));
  }

  return anthropicClient.messages.create({
    model: MODEL,
    max_tokens,
    system,
    messages,
  });
}

async function chat(messages, context = '', sessionId = null) {
  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\nKontekst z bazy wiedzy:\n${context}`
    : SYSTEM_PROMPT;

  const response = await createMessage({
    max_tokens: 1024,
    system: systemWithContext,
    messages,
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = calcLlmCost(inputTokens, outputTokens);

  await logCost({ service: 'llm', operation: 'chat', tokensInput: inputTokens, tokensOutput: outputTokens, costUsd, sessionId });

  return { content: response.content[0].text, usage: { inputTokens, outputTokens }, costUsd };
}

async function parseVoiceIntent(transcript, cashflowSummary = null) {
  const cfContext = cashflowSummary ? `\nAktualny Cash Flow: ${JSON.stringify(cashflowSummary)}` : '';

  const response = await createMessage({
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Przetwórz polecenie głosowe i zwróć TYLKO JSON (bez markdown):
"${transcript}"${cfContext}

{
  "action": "create_task|update_task|query_finances|query_tasks|add_invoice|general",
  "data": {
    "title": "",
    "priority": "low|medium|high",
    "deadline": "YYYY-MM-DD lub null",
    "client": "",
    "requires_budget": false,
    "budget_amount": 0,
    "status": "todo|in_progress|done"
  },
  "message": "potwierdzenie po polsku"
}`,
    }],
  });

  const costUsd = calcLlmCost(response.usage.input_tokens, response.usage.output_tokens);
  await logCost({ service: 'llm', operation: 'intent_parse', tokensInput: response.usage.input_tokens, tokensOutput: response.usage.output_tokens, costUsd });

  try {
    const text = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return { ...JSON.parse(text), costUsd };
  } catch {
    return { action: 'general', data: {}, message: response.content[0].text, costUsd };
  }
}

async function generateKpiAnalysis(tasks, financialDocs, cashflow) {
  const response = await createMessage({
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Przeanalizuj dane i wygeneruj raport KPI (TYLKO JSON bez markdown):
Zadania: ${JSON.stringify(tasks.slice(0, 50))}
Faktury: ${JSON.stringify(financialDocs.slice(0, 20))}
CashFlow: ${JSON.stringify(cashflow.slice(0, 30))}

{
  "task_completion_rate": 0.0,
  "avg_completion_days": 0,
  "overdue_tasks": 0,
  "dso_days": 0,
  "pending_invoices_total": 0,
  "overdue_invoices": 0,
  "monthly_revenue": 0,
  "monthly_expenses": 0,
  "cash_flow_alert": "",
  "recommendations": []
}`,
    }],
  });

  const costUsd = calcLlmCost(response.usage.input_tokens, response.usage.output_tokens);
  await logCost({ service: 'llm', operation: 'kpi_analysis', tokensInput: response.usage.input_tokens, tokensOutput: response.usage.output_tokens, costUsd });

  try {
    const text = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return { ...JSON.parse(text), costUsd };
  } catch {
    return { error: 'Parse error', raw: response.content[0].text, costUsd };
  }
}

module.exports = { chat, parseVoiceIntent, generateKpiAnalysis };
