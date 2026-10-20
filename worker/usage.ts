import {
  ACCOUNT_DATA_LIMIT_BYTES,
  AI_DAILY_TOKEN_LIMIT,
  AI_FALLBACK_MODEL,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_OUTPUT_TOKENS,
  AI_MODEL,
  buildLocalAssistantReply,
  estimateTokens,
  prepareAssistantMessages,
  truncateToTokenLimit,
  utf8ByteLength,
  type AccountUsage,
  type AssistantChatResponse,
} from '../shared/assistant';
import type { Env } from './auth';

type EntryTotalsRow = { entry_count: number; entry_bytes: number };
type HabitTotalsRow = { habit_count: number; bytes: number };
type BytesRow = { bytes: number };
type AiUsageRow = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  request_count: number;
};

export function utcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getAccountUsage(
  db: D1Database,
  ownerId: string,
  date = utcDateString(),
): Promise<AccountUsage> {
  const [entriesResult, habitsResult, prefsResult, aiResult] = await db.batch([
    db
      .prepare(
        'SELECT COUNT(*) AS entry_count, COALESCE(SUM(length(CAST(data AS BLOB)) + length(CAST(date AS BLOB))), 0) AS entry_bytes FROM entries WHERE owner_id = ?',
      )
      .bind(ownerId),
    db
      .prepare(
        'SELECT COUNT(*) AS habit_count, COALESCE(SUM(length(CAST(key AS BLOB)) + length(CAST(name AS BLOB))), 0) AS bytes FROM habit_definitions WHERE owner_id = ?',
      )
      .bind(ownerId),
    db
      .prepare(
        'SELECT COALESCE(SUM(length(CAST(key AS BLOB)) + length(CAST(payload AS BLOB))), 0) AS bytes FROM user_preferences WHERE owner_id = ?',
      )
      .bind(ownerId),
    db
      .prepare(
        'SELECT prompt_tokens, completion_tokens, total_tokens, request_count FROM ai_daily_usage WHERE owner_id = ? AND date = ?',
      )
      .bind(ownerId, date),
  ]);

  const entryRow = (entriesResult.results[0] as EntryTotalsRow | undefined) || {
    entry_count: 0,
    entry_bytes: 0,
  };
  const habitRow = (habitsResult.results[0] as HabitTotalsRow | undefined) || {
    habit_count: 0,
    bytes: 0,
  };
  const prefRow = (prefsResult.results[0] as BytesRow | undefined) || { bytes: 0 };
  const aiRow = (aiResult.results[0] as AiUsageRow | undefined) || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    request_count: 0,
  };

  const entryBytes = Number(entryRow.entry_bytes || 0);
  const entryCount = Number(entryRow.entry_count || 0);
  const habitBytes = Number(habitRow.bytes || 0);
  const habitCount = Number(habitRow.habit_count || 0);
  const preferenceBytes = Number(prefRow.bytes || 0);
  const usedBytes = entryBytes + habitBytes + preferenceBytes;

  const promptTokensToday = Number(aiRow.prompt_tokens || 0);
  const completionTokensToday = Number(aiRow.completion_tokens || 0);
  const usedTokensToday = Number(aiRow.total_tokens || 0);
  const requestsToday = Number(aiRow.request_count || 0);

  return {
    date,
    ai: {
      usedTokensToday,
      dailyTokenLimit: AI_DAILY_TOKEN_LIMIT,
      remainingTokensToday: Math.max(0, AI_DAILY_TOKEN_LIMIT - usedTokensToday),
      promptTokensToday,
      completionTokensToday,
      requestsToday,
      maxInputTokens: AI_MAX_INPUT_TOKENS,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    },
    storage: {
      usedBytes,
      limitBytes: ACCOUNT_DATA_LIMIT_BYTES,
      remainingBytes: Math.max(0, ACCOUNT_DATA_LIMIT_BYTES - usedBytes),
      entryBytes,
      entryCount,
      habitBytes,
      habitCount,
      preferenceBytes,
    },
  };
}

export async function existingEntryBytes(
  db: D1Database,
  ownerId: string,
  date: string,
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT COALESCE(length(CAST(data AS BLOB)) + length(CAST(date AS BLOB)), 0) AS bytes FROM entries WHERE owner_id = ? AND date = ?',
    )
    .bind(ownerId, date)
    .first<BytesRow>();
  return Number(row?.bytes || 0);
}

export async function existingHabitBytes(
  db: D1Database,
  ownerId: string,
  key: string,
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT COALESCE(length(CAST(key AS BLOB)) + length(CAST(name AS BLOB)), 0) AS bytes FROM habit_definitions WHERE owner_id = ? AND key = ?',
    )
    .bind(ownerId, key)
    .first<BytesRow>();
  return Number(row?.bytes || 0);
}

export async function existingPreferenceBytes(
  db: D1Database,
  ownerId: string,
  key: string,
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT COALESCE(length(CAST(key AS BLOB)) + length(CAST(payload AS BLOB)), 0) AS bytes FROM user_preferences WHERE owner_id = ? AND key = ?',
    )
    .bind(ownerId, key)
    .first<BytesRow>();
  return Number(row?.bytes || 0);
}

export async function enforceStorageQuota(
  db: D1Database,
  ownerId: string,
  deltaBytes: number,
): Promise<void> {
  if (deltaBytes <= 0) return;
  const usage = await getAccountUsage(db, ownerId);
  if (usage.storage.usedBytes + deltaBytes > ACCOUNT_DATA_LIMIT_BYTES) {
    throw Response.json(
      {
        error:
          'Account storage limit of 10 MB reached. Export and delete older entries before saving more data.',
      },
      { status: 413 },
    );
  }
}

type WorkersAiOutput = {
  response?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

async function runWorkersAi(
  env: Env,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxOutputTokens: number,
): Promise<{
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
} | null> {
  if (!env.AI || typeof env.AI.run !== 'function') return null;
  for (const model of [AI_MODEL, AI_FALLBACK_MODEL]) {
    try {
      const output = (await env.AI.run(model, {
        messages,
        max_tokens: maxOutputTokens,
        temperature: 0.3,
      })) as WorkersAiOutput | null;
      const text = typeof output?.response === 'string' ? output.response.trim() : '';
      if (text) {
        return {
          text,
          model,
          promptTokens: output?.usage?.prompt_tokens,
          completionTokens: output?.usage?.completion_tokens,
        };
      }
    } catch {
      // Fall back to the secondary model or local guide when Workers AI is offline in local dev.
    }
  }
  return null;
}

export async function handleAssistantChat(
  env: Env,
  owner: { id: string; email: string },
  body: unknown,
  date = utcDateString(),
): Promise<AssistantChatResponse> {
  const currentUsage = await getAccountUsage(env.DB, owner.id, date);
  const usedBefore = currentUsage.ai.usedTokensToday;

  let prepared: ReturnType<typeof prepareAssistantMessages>;
  try {
    prepared = prepareAssistantMessages(body, AI_MAX_OUTPUT_TOKENS);
  } catch (cause) {
    if (cause instanceof Error && !(cause as { issues?: unknown }).issues) {
      throw Response.json({ error: cause.message }, { status: 400 });
    }
    throw cause;
  }

  if (usedBefore + prepared.promptTokens > AI_DAILY_TOKEN_LIMIT) {
    throw Response.json(
      {
        error: 'Daily AI token limit of 30,000 tokens reached. Your allowance resets at 00:00 UTC.',
      },
      { status: 429 },
    );
  }

  const remainingForOutput = Math.max(
    1,
    Math.min(AI_MAX_OUTPUT_TOKENS, AI_DAILY_TOKEN_LIMIT - usedBefore - prepared.promptTokens),
  );
  if (remainingForOutput < AI_MAX_OUTPUT_TOKENS) {
    prepared = prepareAssistantMessages(body, remainingForOutput);
  }

  const aiResult = await runWorkersAi(env, prepared.messages, remainingForOutput);
  const rawReply =
    aiResult?.text ||
    buildLocalAssistantReply(prepared.userMessage, prepared.language, prepared.pathname);
  const model = aiResult?.model || 'teddmhen-guide-local';

  const promptTokens = Math.min(
    AI_MAX_INPUT_TOKENS,
    Math.max(prepared.promptTokens, Number(aiResult?.promptTokens || 0)),
  );
  if (usedBefore + promptTokens > AI_DAILY_TOKEN_LIMIT) {
    throw Response.json(
      {
        error: 'Daily AI token limit of 30,000 tokens reached. Your allowance resets at 00:00 UTC.',
      },
      { status: 429 },
    );
  }

  const maxCompletionAllowed = Math.max(
    1,
    Math.min(AI_MAX_OUTPUT_TOKENS, AI_DAILY_TOKEN_LIMIT - usedBefore - promptTokens),
  );
  const truncated = truncateToTokenLimit(rawReply, maxCompletionAllowed);
  const completionTokens = Math.min(
    maxCompletionAllowed,
    Math.max(
      truncated.tokens,
      aiResult?.completionTokens ? Math.min(aiResult.completionTokens, maxCompletionAllowed) : 0,
      estimateTokens(truncated.text),
    ),
  );
  const totalTokens = promptTokens + completionTokens;

  const [, updateResult] = await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id, email) VALUES(?, ?) ON CONFLICT(id) DO NOTHING').bind(
      owner.id,
      owner.email,
    ),
    env.DB.prepare(
      `INSERT INTO ai_daily_usage(owner_id, date, prompt_tokens, completion_tokens, total_tokens, request_count)
       VALUES(?, ?, ?, ?, ?, 1)
       ON CONFLICT(owner_id, date) DO UPDATE SET
         prompt_tokens = ai_daily_usage.prompt_tokens + excluded.prompt_tokens,
         completion_tokens = ai_daily_usage.completion_tokens + excluded.completion_tokens,
         total_tokens = ai_daily_usage.total_tokens + excluded.total_tokens,
         request_count = ai_daily_usage.request_count + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE ai_daily_usage.total_tokens + excluded.total_tokens <= ?
       RETURNING prompt_tokens, completion_tokens, total_tokens, request_count`,
    ).bind(owner.id, date, promptTokens, completionTokens, totalTokens, AI_DAILY_TOKEN_LIMIT),
  ]);

  const updatedRow = updateResult.results[0] as AiUsageRow | undefined;
  if (!updatedRow) {
    throw Response.json(
      {
        error: 'Daily AI token limit of 30,000 tokens reached. Your allowance resets at 00:00 UTC.',
      },
      { status: 429 },
    );
  }

  const usedTokensToday = Number(updatedRow.total_tokens);
  const requestsToday = Number(updatedRow.request_count);
  return {
    reply: truncated.text,
    model,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      usedTokensToday,
      dailyTokenLimit: AI_DAILY_TOKEN_LIMIT,
      remainingTokensToday: Math.max(0, AI_DAILY_TOKEN_LIMIT - usedTokensToday),
      requestsToday,
      maxInputTokens: AI_MAX_INPUT_TOKENS,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    },
  };
}

export function entryStorageBytes(date: string, dataJson: string): number {
  return utf8ByteLength(date) + utf8ByteLength(dataJson);
}

export function habitStorageBytes(key: string, name: string): number {
  return utf8ByteLength(key) + utf8ByteLength(name);
}

export function preferenceStorageBytes(key: string, payloadJson: string): number {
  return utf8ByteLength(key) + utf8ByteLength(payloadJson);
}
