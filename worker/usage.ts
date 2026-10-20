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
  result?: { response?: string };
  choices?: {
    message?: { content?: string };
    delta?: { content?: string };
    text?: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function extractAiText(output: WorkersAiOutput | null | undefined): string {
  if (!output || typeof output !== 'object') return '';
  if (typeof output.response === 'string') return output.response;
  if (typeof output.result?.response === 'string') return output.result.response;
  const choice = Array.isArray(output.choices) ? output.choices[0] : undefined;
  if (typeof choice?.delta?.content === 'string') return choice.delta.content;
  if (typeof choice?.message?.content === 'string') return choice.message.content;
  if (typeof choice?.text === 'string') return choice.text;
  return '';
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return Boolean(value && typeof (value as ReadableStream<Uint8Array>).getReader === 'function');
}

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
      const text = extractAiText(output).trim();
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

async function recordAiUsage(
  db: D1Database,
  owner: { id: string; email: string },
  date: string,
  usedBefore: number,
  preparedPromptTokens: number,
  rawReply: string,
  model: string,
  aiPromptTokens?: number,
  aiCompletionTokens?: number,
): Promise<AssistantChatResponse> {
  const promptTokens = Math.min(
    AI_MAX_INPUT_TOKENS,
    Math.max(preparedPromptTokens, Number(aiPromptTokens || 0)),
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
      aiCompletionTokens ? Math.min(aiCompletionTokens, maxCompletionAllowed) : 0,
      estimateTokens(truncated.text),
    ),
  );
  const totalTokens = promptTokens + completionTokens;

  const [, updateResult] = await db.batch([
    db
      .prepare('INSERT INTO users(id, email) VALUES(?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(owner.id, owner.email),
    db
      .prepare(
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
      )
      .bind(owner.id, date, promptTokens, completionTokens, totalTokens, AI_DAILY_TOKEN_LIMIT),
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

  return recordAiUsage(
    env.DB,
    owner,
    date,
    usedBefore,
    prepared.promptTokens,
    rawReply,
    model,
    aiResult?.promptTokens,
    aiResult?.completionTokens,
  );
}

export async function handleAssistantChatStream(
  env: Env,
  owner: { id: string; email: string },
  body: unknown,
  date = utcDateString(),
): Promise<Response> {
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

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const sendEvent = async (payload: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  void (async () => {
    let accumulated = '';
    let usedModel = 'teddmhen-guide-local';
    let aiPromptTokens: number | undefined;
    let aiCompletionTokens: number | undefined;

    const pushDelta = async (piece: string) => {
      if (!piece) return;
      if (estimateTokens(accumulated + piece) > remainingForOutput) return;
      accumulated += piece;
      await sendEvent({ type: 'delta', delta: piece });
    };

    try {
      await writer.write(encoder.encode(': stream-open\n\n'));

      if (env.AI && typeof env.AI.run === 'function') {
        for (const model of [AI_MODEL, AI_FALLBACK_MODEL]) {
          try {
            const output = await env.AI.run(model, {
              messages: prepared.messages,
              max_tokens: remainingForOutput,
              temperature: 0.3,
              stream: true,
            });
            if (isReadableStream(output)) {
              const reader = output.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const rawLine of lines) {
                  const line = rawLine.trim();
                  if (!line.startsWith('data:')) continue;
                  const dataStr = line.slice(5).trim();
                  if (!dataStr || dataStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(dataStr) as WorkersAiOutput;
                    if (parsed.usage?.prompt_tokens) aiPromptTokens = parsed.usage.prompt_tokens;
                    if (parsed.usage?.completion_tokens)
                      aiCompletionTokens = parsed.usage.completion_tokens;
                    const delta = extractAiText(parsed);
                    if (delta) await pushDelta(delta);
                  } catch {
                    // Ignore partial or non-JSON SSE comments
                  }
                }
              }
              if (accumulated.trim()) {
                usedModel = model;
                break;
              }
            } else {
              const parsed = output as WorkersAiOutput | null;
              const text = extractAiText(parsed).trim();
              if (text) {
                usedModel = model;
                aiPromptTokens = parsed?.usage?.prompt_tokens;
                aiCompletionTokens = parsed?.usage?.completion_tokens;
                for (const chunk of text.match(/.{1,6}/gs) || [text]) {
                  await pushDelta(chunk);
                }
                break;
              }
            }
          } catch {
            // Fall back to next model or local guide
          }
        }
      }

      if (!accumulated.trim()) {
        const fallback = buildLocalAssistantReply(
          prepared.userMessage,
          prepared.language,
          prepared.pathname,
        );
        usedModel = 'teddmhen-guide-local';
        for (const chunk of fallback.match(/.{1,6}/gs) || [fallback]) {
          await pushDelta(chunk);
        }
      }

      const finalized = await recordAiUsage(
        env.DB,
        owner,
        date,
        usedBefore,
        prepared.promptTokens,
        accumulated.trim(),
        usedModel,
        aiPromptTokens,
        aiCompletionTokens,
      );
      await sendEvent({ type: 'done', ...finalized });
    } catch (cause) {
      try {
        if (cause instanceof Response) {
          const errBody = (await cause.json().catch(() => ({}))) as { error?: string };
          await sendEvent({
            type: 'error',
            error: errBody.error || 'Daily AI token limit reached.',
          });
        } else {
          await sendEvent({
            type: 'error',
            error: 'The request could not be completed. Please try again.',
          });
        }
      } catch {
        // Ignore write errors if client closed stream
      }
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      'Content-Encoding': 'identity',
      'X-Accel-Buffering': 'no',
    },
  });
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
