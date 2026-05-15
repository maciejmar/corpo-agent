const { QdrantClient } = require('@qdrant/js-client-rest');
const Anthropic = require('@anthropic-ai/sdk');
const { logCost, calcLlmCost } = require('../middleware/costTracker');

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://qdrant:6333',
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const COLLECTION = process.env.QDRANT_COLLECTION || 'corp_agent';
const VECTOR_SIZE = 1536;

async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
  } catch {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    console.log(`Qdrant collection "${COLLECTION}" created.`);
  }
}

async function embed(text) {
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  const costUsd = (embResponse.usage.total_tokens / 1_000_000) * 0.02;
  await logCost({ service: 'qdrant', operation: 'embed', tokensInput: embResponse.usage.total_tokens, costUsd });
  return embResponse.data[0].embedding;
}

async function upsertDocument(id, text, metadata = {}) {
  await ensureCollection();
  const vector = await embed(text);
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: [{ id: id.replace(/-/g, '').slice(0, 16), vector, payload: { text: text.slice(0, 2000), ...metadata } }],
  });
}

async function search(query, limit = 5) {
  await ensureCollection();
  const vector = await embed(query);
  const results = await qdrant.search(COLLECTION, { vector, limit, with_payload: true });
  return results.map(r => ({ score: r.score, ...r.payload }));
}

module.exports = { upsertDocument, search, ensureCollection };
