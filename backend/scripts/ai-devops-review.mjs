#!/usr/bin/env node
/**
 * Agentic DevOps Review — uruchamiany przez GitHub Actions na PR do main.
 * Analizuje diff przez Claude i wypisuje raport Markdown.
 * Exit 1 gdy wykryto [CRITICAL] issue → blokuje merge.
 */
import Anthropic from '@anthropic-ai/sdk';
import { execFileSync, execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log('ANTHROPIC_API_KEY is not set; skipping AI DevOps review.');
  process.exit(0);
}

const BASE_REF = process.env.BASE_REF || 'origin/main';
const MODEL    = process.env.AI_REVIEW_MODEL || 'claude-sonnet-4-5-20250929';
const MAX_DIFF = 120_000;

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
  } catch { return ''; }
}

const commits  = git('log', '--oneline', `${BASE_REF}..HEAD`);
const diffStat = git('diff', `${BASE_REF}`, '--stat');
let   diffFull = git('diff', '--unified=3', `${BASE_REF}...HEAD`);

if (!diffFull.trim()) {
  console.log('✅ No diff to review.');
  process.exit(0);
}

if (diffFull.length > MAX_DIFF) {
  diffFull = diffFull.slice(0, MAX_DIFF) + '\n\n[... diff truncated ...]';
}

const commitCount = commits.split('\n').filter(Boolean).length;
console.log(`🤖 AI DevOps Review — model: ${MODEL}`);
console.log(`📊 Analizuję ${commitCount} commit(ów)...\n`);

// ── Prompt ────────────────────────────────────────────────────────────────────

const systemPrompt = `You are a Senior DevOps/Security/Platform Engineer reviewing a Pull Request.
Focus on: deployment safety, hardcoded secrets, IAM misconfigurations, Terraform issues,
Docker security, CI/CD pipeline risks, rollback capability, observability gaps, cloud cost risks.
Be concise and actionable. Respond entirely in Polish.`;

const userPrompt = `Przeanalizuj ten Pull Request.

## Commity (${commitCount})
${commits || '(brak)'}

## Statystyki zmian
${diffStat || '(brak)'}

## Diff
\`\`\`diff
${diffFull}
\`\`\`

---

Zwróć raport DOKŁADNIE w tym formacie Markdown:

## 🔒 Bezpieczeństwo
Każdy issue w formacie: \`[CRITICAL]\` / \`[HIGH]\` / \`[MEDIUM]\` / \`[LOW]\` — opis i lokalizacja.
Uwzględnij: hardcoded secrets, otwarte security groups, błędne IAM policies, brakujące encryption.

## 🏗️ Infrastruktura (Terraform / Docker / CI)
Problemy: kosztowne zasoby, brak deletion_protection, brak health checks, błędne sidecar config itp.

## 🐛 Jakość kodu
Bugi, nieobsłużone błędy, race conditions, brakujące walidacje.

## ✅ Co jest dobrze
Pozytywne aspekty PR (max 3 punkty).

## 📋 Wymagane zmiany przed merge
Numerowana lista BLOKUJĄCYCH zmian. Napisz "Brak." jeśli PR jest gotowy.

## 🎯 Werdykt
Dokładnie jedna z opcji: \`APPROVE\` | \`REQUEST_CHANGES\` | \`COMMENT\`
Następnie jedno zdanie po polsku wyjaśniające decyzję.`;

// ── Wywołaj Claude ────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey });

const response = await client.messages.create({
  model: MODEL,
  max_tokens: 2048,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
});

const review = response.content[0].text;
const usage  = response.usage;
const costUsd = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;

// ── Wydrukuj raport ───────────────────────────────────────────────────────────

console.log('─'.repeat(72));
console.log(review);
console.log('─'.repeat(72));
console.log(`\n📈 Tokens: ${usage.input_tokens} in / ${usage.output_tokens} out | 💸 ~$${costUsd.toFixed(5)}`);

// ── GitHub Step Summary ───────────────────────────────────────────────────────

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## 🤖 AI DevOps Review\n\n${review}\n\n> Model: \`${MODEL}\` | Koszt: ~$${costUsd.toFixed(5)}\n`
  );
}

// ── Blokuj pipeline na CRITICAL ───────────────────────────────────────────────

if (review.includes('[CRITICAL]')) {
  console.error('\n❌ Wykryto [CRITICAL] issues — pipeline zablokowany. Napraw przed merge.');
  process.exit(1);
}

if (review.includes('REQUEST_CHANGES')) {
  console.warn('\n⚠️  AI sugeruje zmiany przed merge (pipeline nie jest zablokowany).');
}

console.log('\n✅ Review zakończony.');

