import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index';
import { adapter } from './database';
import type { Env } from '../worker/auth';
import { emptyEntry } from '../shared/schema';
import {
  ACCOUNT_DATA_LIMIT_BYTES,
  AI_DAILY_TOKEN_LIMIT,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_OUTPUT_TOKENS,
  AI_MODEL,
  buildLocalAssistantReply,
  buildSystemPrompt,
  estimateTokens,
  isBulkCodeOrData,
  prepareAssistantMessages,
  truncateToTokenLimit,
  type AccountUsage,
  type AssistantChatResponse,
} from '../shared/assistant';

let actor = 'owner-a';
vi.mock('../worker/auth', () => ({
  authenticate: async () => ({ id: actor, email: `${actor}@example.test` }),
  isLocal: () => false,
  authenticateLegacy: async () => ({ id: 'legacy-owner', email: 'legacy@example.test' }),
}));

let env: Env, sqlite: DatabaseSync;

async function call(
  path: string,
  method = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
) {
  return worker.fetch(
    new Request(`https://journal.example${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Teddmhen-Request': '1',
        Origin: 'https://journal.example',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}

beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0002_accounts.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0003_administrators.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0005_habit_definitions.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0007_preferences.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0008_ai_usage.sql', 'utf8'));
  env = { DB: adapter(sqlite) } as Env;
  actor = 'owner-a';
});

describe('AI guide safeguards, Gemma 4 26B A4B model, 30k daily limit, 1,024 output limit, and 10 MB storage limit', () => {
  it('configures Gemma 4 26B A4B, 30,000 daily tokens, 1,024 output tokens, and sentence-complete truncation', () => {
    expect(AI_MODEL).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(AI_DAILY_TOKEN_LIMIT).toBe(30_000);
    expect(AI_MAX_INPUT_TOKENS).toBe(4096);
    expect(AI_MAX_OUTPUT_TOKENS).toBe(1024);

    const sys = buildSystemPrompt('pl', '/check-in', 1024);
    expect(sys).toContain('strictly 1024 tokens');
    expect(sys).toContain('Never leave a sentence or bullet list unfinished');

    const longReply =
      'First complete sentence explaining how daily check-ins work. Second complete sentence about leaving unrecorded scales unchecked. Third sentence that goes on and on with extra words that would overflow a tiny twentyfive token budget';
    const trimmed = truncateToTokenLimit(longReply, 25);
    expect(trimmed.tokens).toBeLessThanOrEqual(25);
    expect(trimmed.text.endsWith('.')).toBe(true);
    expect(trimmed.text).not.toContain('would overflow');
  });

  it('blocks code, JSON/CSV exports, and prompts exceeding 4,096 input tokens', () => {
    expect(isBulkCodeOrData('How do I log a daily check-in and workouts?')).toBe(false);
    expect(isBulkCodeOrData('Jak działają Trendy i predykcje oraz korelacje z opóźnieniem?')).toBe(
      false,
    );
    expect(isBulkCodeOrData('```ts\nconst x = 1;\n```')).toBe(true);
    expect(
      isBulkCodeOrData('function test() {\n  const a = 1;\n  return a;\n}\nexport default test;'),
    ).toBe(true);
    expect(
      isBulkCodeOrData(
        'date,wellbeing,energy,mood,stress\n2026-01-01,7,6,7,3\n2026-01-02,8,7,8,2\n2026-01-03,6,5,6,4\n2026-01-04,7,7,7,3',
      ),
    ).toBe(true);
    expect(() =>
      prepareAssistantMessages({
        language: 'en',
        message: 'word '.repeat(5000),
      }),
    ).toThrow(
      'Your message exceeds the 4,096-token input limit. Shorten your question and try again.',
    );
  });

  it('answers guide questions in all 6 languages and tracks daily tokens and overall storage', async () => {
    const initialUsage = (await (await call('/api/account/usage')).json()) as AccountUsage;
    expect(initialUsage.ai).toMatchObject({
      usedTokensToday: 0,
      dailyTokenLimit: 30_000,
      remainingTokensToday: 30_000,
      maxInputTokens: 4096,
      maxOutputTokens: 1024,
      requestsToday: 0,
    });
    expect(initialUsage.storage).toMatchObject({
      usedBytes: 0,
      limitBytes: ACCOUNT_DATA_LIMIT_BYTES,
      remainingBytes: ACCOUNT_DATA_LIMIT_BYTES,
      entryCount: 0,
      habitCount: 0,
    });

    for (const lang of ['en', 'pl', 'es', 'de', 'fr', 'pt'] as const) {
      expect(buildLocalAssistantReply('How do check-ins work?', lang).length).toBeGreaterThan(40);
    }

    const chatRes = await call('/api/chat', 'POST', {
      language: 'pl',
      message: 'Jak zapisać codzienny wpis i treningi?',
    });
    expect(chatRes.status).toBe(200);
    const chatBody = (await chatRes.json()) as AssistantChatResponse;
    expect(chatBody.reply).toContain('Codzienny wpis');
    expect(chatBody.usage.totalTokens).toBeGreaterThan(0);
    expect(chatBody.usage.usedTokensToday).toBe(chatBody.usage.totalTokens);
    expect(chatBody.usage.requestsToday).toBe(1);

    const codeAttempt = await call('/api/chat', 'POST', {
      language: 'en',
      message: '```json\n{"entries":[1,2,3]}\n```',
    });
    expect(codeAttempt.status).toBe(400);
    expect(((await codeAttempt.json()) as { error: string }).error).toBe(
      'The AI guide answers questions about using Tedd’mhen. Pasting source code, exports, or bulk data is not allowed.',
    );

    // Verify Workers AI binding integration with @cf/google/gemma-4-26b-a4b-it
    let calledModel = '';
    let calledMaxTokens = 0;
    env = {
      DB: adapter(sqlite),
      AI: {
        run: async (model: string, input: { max_tokens?: number }) => {
          calledModel = model;
          calledMaxTokens = input.max_tokens || 0;
          return {
            response: 'Cloudflare Workers AI Gemma 4 26B A4B guide response.',
            usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
          };
        },
      },
    } as unknown as Env;
    const workerAiRes = await call('/api/chat', 'POST', {
      language: 'en',
      message: 'How do custom habits work?',
    });
    expect(workerAiRes.status).toBe(200);
    const workerAiBody = (await workerAiRes.json()) as AssistantChatResponse;
    expect(calledModel).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(calledMaxTokens).toBe(1024);
    expect(workerAiBody.reply).toBe('Cloudflare Workers AI Gemma 4 26B A4B guide response.');
    expect(workerAiBody.usage.requestsToday).toBe(2);

    // Exhaust the daily 30,000 token allowance
    const today = initialUsage.date;
    sqlite
      .prepare('UPDATE ai_daily_usage SET total_tokens = ? WHERE owner_id = ? AND date = ?')
      .run(AI_DAILY_TOKEN_LIMIT, actor, today);
    const exhaustedRes = await call('/api/chat', 'POST', {
      language: 'en',
      message: 'One more question?',
    });
    expect(exhaustedRes.status).toBe(429);
    expect(((await exhaustedRes.json()) as { error: string }).error).toBe(
      'Daily AI token limit of 30,000 tokens reached. Your allowance resets at 00:00 UTC.',
    );
  });

  it('tracks per-account storage bytes and enforces the 10 MB overall account storage limit', async () => {
    const entry = {
      ...emptyEntry('2026-02-01'),
      wellbeing: 8,
      notes: 'Steady aerobic base week.',
    };
    expect((await call('/api/entries/2026-02-01', 'PUT', { entry, revision: 0 })).status).toBe(201);
    const afterSave = (await (await call('/api/account/usage')).json()) as AccountUsage;
    expect(afterSave.storage.usedBytes).toBeGreaterThan(100);
    expect(afterSave.storage.entryCount).toBe(1);

    // Seed near-limit storage for owner-a and verify writes above 10 MB are rejected with 413
    const chunk = JSON.stringify({ pad: 'x'.repeat(1_000_000) });
    for (let i = 0; i < 10; i++) {
      sqlite
        .prepare('INSERT INTO entries (owner_id, date, data) VALUES (?, ?, ?)')
        .run(actor, `2025-01-${String(i + 1).padStart(2, '0')}`, chunk);
    }
    sqlite
      .prepare('INSERT INTO entries (owner_id, date, data) VALUES (?, ?, ?)')
      .run(actor, '2025-01-20', JSON.stringify({ pad: 'y'.repeat(485_500) }));

    const overQuotaEntry = {
      ...emptyEntry('2026-02-02'),
      notes: 'z'.repeat(2000),
    };
    const rejected = await call('/api/entries/2026-02-02', 'PUT', {
      entry: overQuotaEntry,
      revision: 0,
    });
    expect(rejected.status).toBe(413);
    expect(((await rejected.json()) as { error: string }).error).toBe(
      'Account storage limit of 10 MB reached. Export and delete older entries before saving more data.',
    );
    expect(estimateTokens('short text')).toBeGreaterThan(0);
  });
});
