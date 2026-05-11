#!/usr/bin/env node
/**
 * AI provider probe — fires one minimal request at the configured AI
 * provider (Gemini by default) and prints the response shape so you can
 * tell whether the key is live without running a full /api/analyze
 * cycle.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/ai-probe.mjs
 *   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... node scripts/ai-probe.mjs
 *
 * Reads the same env vars the backend reads (GEMINI_API_KEY,
 * GOOGLE_API_KEY, ANTHROPIC_API_KEY, AI_PROVIDER, GEMINI_MODEL,
 * ANTHROPIC_MODEL) — so a successful run here means /api/analyze will
 * also produce AI commentary.
 */
import process from 'node:process';

const provider = (process.env.AI_PROVIDER || '').toLowerCase()
              || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'gemini' : '')
              || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : '');

if (!provider) {
  console.error('FAIL: no provider key on env. Set GEMINI_API_KEY (or ANTHROPIC_API_KEY) and re-run.');
  process.exit(2);
}

async function probeGemini() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!key) { console.error('FAIL: GEMINI_API_KEY not set'); process.exit(2); }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
      generationConfig: { maxOutputTokens: 10, temperature: 0 }
    })
  });
  const ms = Date.now() - t0;
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`FAIL: gemini http ${resp.status} in ${ms}ms\n${body.slice(0, 800)}`);
    process.exit(1);
  }
  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '(empty)';
  console.log(`OK  gemini ${model}  ${ms}ms  → "${text.trim()}"`);
}

async function probeAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  if (!key) { console.error('FAIL: ANTHROPIC_API_KEY not set'); process.exit(2); }
  const t0 = Date.now();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model, max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }]
    })
  });
  const ms = Date.now() - t0;
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`FAIL: anthropic http ${resp.status} in ${ms}ms\n${body.slice(0, 800)}`);
    process.exit(1);
  }
  const json = await resp.json();
  const text = json?.content?.[0]?.text || '(empty)';
  console.log(`OK  anthropic ${model}  ${ms}ms  → "${text.trim()}"`);
}

(async () => {
  if (provider === 'gemini')        await probeGemini();
  else if (provider === 'anthropic') await probeAnthropic();
  else { console.error(`FAIL: unknown provider "${provider}"`); process.exit(2); }
})().catch(err => { console.error('FAIL:', err.message || err); process.exit(1); });
