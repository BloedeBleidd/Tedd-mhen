import { adminOverview, isAdministrator } from './admin';
import { DEMO_DATASET, DEMO_OWNER } from '../shared/demo';
import { z } from 'zod';
import { authenticate, authenticateLegacy, isLocal, type Env } from './auth';
import {
  dateSchema,
  dayNumber,
  entrySchema,
  localDate,
  shiftDate,
  workoutTypes,
  type StoredEntry,
} from '../shared/schema';
import {
  allowedExportFields,
  csvCell,
  exportDictionary,
  exportGroups,
  flatten,
  markdownEntry,
  selectFields,
  type ExportFormat,
  type ExportGroup,
} from '../shared/export';

const MAX_BODY = 256 * 1024;
const json = (data: unknown, status = 200) => Response.json(data, { status });
const error = (message: string, status = 400): never => {
  throw json({ error: message }, status);
};
type Row = { date: string; data: string; revision: number; created_at: string; updated_at: string };
const fromRow = (row: Row): StoredEntry => ({
  ...JSON.parse(row.data),
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
// Large narratives never enter list / analytics responses.
const summarySelect = `SELECT date, revision, created_at, updated_at,
  json_remove(data, '$.notes', '$.sleepNotes', '$.illnessNotes', '$.workouts') AS data,
  json_array_length(data, '$.workouts') AS workout_count,
  (SELECT json_group_array(DISTINCT json_extract(value, '$.type')) FROM json_each(entries.data, '$.workouts')) AS workout_types,
  CASE WHEN json_extract(data, '$.trainingStatus') = 'unrecorded' THEN NULL ELSE
    COALESCE((SELECT SUM(json_extract(value, '$.durationMinutes')) FROM json_each(entries.data, '$.workouts')), 0) END AS training_minutes,
  CASE WHEN json_extract(data, '$.trainingStatus') = 'unrecorded' OR
    EXISTS(SELECT 1 FROM json_each(entries.data, '$.workouts') WHERE json_extract(value, '$.effort') IS NULL) THEN NULL ELSE
    COALESCE((SELECT SUM(json_extract(value, '$.durationMinutes') * json_extract(value, '$.effort')) FROM json_each(entries.data, '$.workouts')), 0) END AS training_load
  FROM entries`;
type SummaryRow = Row & {
  workout_count: number;
  workout_types: string;
  training_minutes: number | null;
  training_load: number | null;
};
function summary(row: SummaryRow) {
  return {
    ...fromRow(row),
    workoutCount: row.workout_count,
    workoutTypes: JSON.parse(row.workout_types),
    trainingMinutes: row.training_minutes,
    trainingLoad: row.training_load,
  };
}
function filters(url: URL, owner: string) {
  const from = url.searchParams.get('from') || '1900-01-01';
  const to = url.searchParams.get('to') || '2200-12-31';
  dateSchema.parse(from);
  dateSchema.parse(to);
  if (from > to) error('Start date must be on or before end date.');
  const clauses = ['owner_id = ?', 'date >= ?', 'date <= ?'];
  const params: (string | number)[] = [owner, from, to];
  const query = url.searchParams.get('q');
  if (query) {
    if (query.length > 200) error('Search must be 200 characters or fewer.');
    clauses.push('instr(lower(data), lower(?)) > 0');
    params.push(query);
  }
  const type = url.searchParams.get('type');
  if (type) {
    z.enum(workoutTypes).parse(type);
    clauses.push(
      "EXISTS(SELECT 1 FROM json_each(entries.data, '$.workouts') WHERE json_extract(value, '$.type') = ?)",
    );
    params.push(type);
  }
  const illness = url.searchParams.get('illness');
  if (illness === 'yes')
    clauses.push(
      "(json_extract(data, '$.illnessSeverity') > 0 OR json_array_length(data, '$.symptoms') > 0)",
    );
  else if (illness === 'no') clauses.push("json_extract(data, '$.illnessSeverity') = 0");
  else if (illness && illness !== 'all') error('Invalid illness filter.');
  return { where: clauses.join(' AND '), params, from, to };
}
async function readBody(request: Request, maximum = MAX_BODY) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    error('Send application/json.', 415);
  const reader = request.body?.getReader();
  if (!reader) error('Request body is required.');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader!.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader!.cancel();
      error(`Request must be smaller than ${maximum / 1024} KiB.`, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return error('Invalid JSON.');
  }
}
async function exportResponse(env: Env, url: URL, owner: string): Promise<Response> {
  const filter = filters(url, owner);
  if (dayNumber(filter.to) - dayNumber(filter.from) > 1830)
    error('Export up to five years at a time. Set a start and end date.');
  const format = z
    .enum(['json', 'ndjson', 'csv', 'md'])
    .parse(url.searchParams.get('format') || 'json') as ExportFormat;
  const groups = z
    .array(z.enum(exportGroups))
    .min(1)
    .max(7)
    .parse((url.searchParams.get('groups') || exportGroups.join(',')).split(',')) as ExportGroup[];
  const fields = url.searchParams.has('fields')
    ? url.searchParams.get('fields')!.split(',')
    : undefined;
  if (fields && (!fields.length || fields.some((f) => !allowedExportFields.includes(f))))
    error('Invalid export field selection.');
  const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM entries WHERE ${filter.where}`)
    .bind(...filter.params)
    .first<number>('count');
  const meta = {
    application: 'Tedd’mhen',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    dateRange: { from: filter.from, to: filter.to },
    filters: {
      query: url.searchParams.get('q') || '',
      type: url.searchParams.get('type') || '',
      illness: url.searchParams.get('illness') || 'all',
    },
    groups,
    fields: fields || 'all in selected groups',
    count,
    dictionary: exportDictionary,
  };
  let cursor = '';
  let first = true;
  let headers: string[] = [];
  let started = false;
  let complete = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const emit = (value: string) => controller.enqueue(encoder.encode(value));
      try {
        if (!started) {
          started = true;
          if (format === 'json') emit(`${JSON.stringify(meta).slice(0, -1)},"entries":[\n`);
          if (format === 'ndjson') emit(`${JSON.stringify({ _meta: meta })}\n`);
          if (format === 'md')
            emit(
              `# Tedd’mhen · Journal export\n\nSelf-reported observations. Associations do not establish causation.\n\n${markdownEntry({ date: 'Export metadata & data dictionary', ...meta })}`,
            );
        }
        if (complete) {
          if (format === 'json') emit('\n]}');
          controller.close();
          return;
        }
        const result = await env.DB.prepare(
          `SELECT * FROM entries WHERE ${filter.where} AND date > ? ORDER BY date ASC LIMIT 50`,
        )
          .bind(...filter.params, cursor)
          .all<Row>();
        for (const record of result.results) {
          const selected = selectFields(fromRow(record), groups, fields);
          if (format === 'json') emit(`${first ? '' : ',\n'}${JSON.stringify(selected)}`);
          if (format === 'ndjson') emit(`${JSON.stringify(selected)}\n`);
          if (format === 'md') emit(markdownEntry(selected));
          if (format === 'csv') {
            const row = flatten(selected);
            if (first) {
              headers = Object.keys(row);
              emit(`\uFEFF${headers.map(csvCell).join(',')}\r\n`);
            }
            emit(`${headers.map((key) => csvCell(row[key])).join(',')}\r\n`);
          }
          first = false;
          cursor = record.date;
        }
        complete = result.results.length < 50;
        if (first && format === 'csv') emit('date\r\n');
      } catch {
        controller.error(
          new Error('Export interrupted. Please retry; do not use a partial download.'),
        );
      }
    },
  });
  const types = {
    json: 'application/json',
    ndjson: 'application/x-ndjson',
    csv: 'text/csv',
    md: 'text/markdown',
  };
  return new Response(stream, {
    headers: {
      'Content-Type': `${types[format]}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="teddmhen-${filter.from}-${filter.to}.${format}"`,
    },
  });
}
export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/auth/')) {
    const headers = new Headers(request.headers);
    headers.delete('X-Legacy-Id');
    headers.delete('X-Legacy-Email');
    if (url.pathname === '/api/auth/claim') {
      const owner = await authenticateLegacy(request, env);
      if (request.method === 'GET') {
        return env.ASSETS.fetch(
          new Request(new URL('/index.html', url), { headers: request.headers }),
        );
      }
      headers.set('X-Legacy-Id', owner.id);
      headers.set('X-Legacy-Email', owner.email);
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!loopback && (url.origin !== env.APP_ORIGIN || url.protocol !== 'https:'))
      return json({ error: 'Invalid application origin.' }, 403);
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (request.headers.get('Origin') !== url.origin || headers.get('X-Teddmhen-Request') !== '1')
      return json({ error: 'Cross-origin or unverified requests are not allowed.' }, 403);
    if (!env.AUTH) return json({ error: 'Account service is unavailable.' }, 503);
    // Finish reading the bounded body before forwarding: a rate-limit response can be immediate.
    const body = JSON.stringify(await readBody(request, 8192));
    headers.delete('Content-Length');
    return env.AUTH.get(env.AUTH.idFromName('accounts')).fetch(
      new Request(request, { headers, body }),
    );
  }
  if (url.pathname === '/api/health' && request.method === 'GET')
    return json({ ok: true, service: 'teddmhen' });
  if (url.pathname === '/api/demo') {
    if (request.method !== 'GET') error('The shared demo is read-only.', 405);
    if (url.search) error('The demo endpoint does not accept parameters.');
    const dataset = await env.DB.prepare(
      'SELECT title, anchor_date, record_count FROM demo_datasets WHERE id = ? AND owner_id = ?',
    )
      .bind(DEMO_DATASET, DEMO_OWNER)
      .first<{ title: string; anchor_date: string; record_count: number }>();
    if (!dataset) error('Demo data is temporarily unavailable. Please try again later.', 503);
    const records = await env.DB.prepare(
      'SELECT date, data, revision, created_at, updated_at FROM entries WHERE owner_id = ? ORDER BY date LIMIT 501',
    )
      .bind(DEMO_OWNER)
      .all<Row>();
    if (
      !records.results.length ||
      records.results.length > 500 ||
      records.results.length !== dataset!.record_count
    )
      error('Demo data is temporarily unavailable. Please try again later.', 503);
    return json({
      id: DEMO_DATASET,
      title: dataset!.title,
      anchorDate: dataset!.anchor_date,
      recordCount: dataset!.record_count,
      entries: records.results.map(fromRow),
    });
  }
  const user = await authenticate(request, env);
  if (url.pathname.startsWith('/api/admin/')) {
    if (!(await isAdministrator(env.DB, user.id))) error('Administrator access is required.', 403);
    if (url.pathname === '/api/admin/overview' && request.method === 'GET')
      return json(await adminOverview(env.DB));
    return json({ error: 'Endpoint not found.' }, 404);
  }
  const expectedUser = request.headers.get('X-Teddmhen-Expected-User');
  if (expectedUser && expectedUser !== user.id)
    error('Your signed-in account changed. Reload before continuing.', 403);
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('X-Teddmhen-Request') !== '1')
      error('Missing request verification header.', 403);
    const origin = request.headers.get('origin');
    if (
      origin &&
      origin !== url.origin &&
      !(isLocal(request, env) && ['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
    )
      error('Cross-origin writes are not allowed.', 403);
  }
  if (url.pathname === '/api/session' && request.method === 'GET')
    return json({
      id: user.id,
      email: user.email,
      local: isLocal(request, env),
      admin: await isAdministrator(env.DB, user.id),
    });
  if (url.pathname === '/api/export' && request.method === 'GET')
    return exportResponse(env, url, user.id);
  if (url.pathname === '/api/series' && request.method === 'GET') {
    const all = url.searchParams.get('all') === 'true';
    if (all) {
      url.searchParams.set('from', '1900-01-01');
      url.searchParams.set('to', '2200-12-31');
    } else {
      if (!url.searchParams.has('from')) url.searchParams.set('from', shiftDate(localDate(), -89));
      if (!url.searchParams.has('to')) url.searchParams.set('to', localDate());
    }
    const f = filters(url, user.id);
    if (!all && dayNumber(f.to) - dayNumber(f.from) > 1830)
      error('Select at most five years, or use All recorded dates.');
    const result = await env.DB.prepare(
      `${summarySelect} WHERE ${f.where} ORDER BY date ASC LIMIT 10001`,
    )
      .bind(...f.params)
      .all<SummaryRow>();
    if (result.results.length > 10000)
      error(
        'This selection exceeds 10,000 recorded days. Choose a date range; no observations were silently truncated.',
        413,
      );
    return json({ entries: result.results.map(summary) });
  }
  if (url.pathname === '/api/entries' && request.method === 'GET') {
    const f = filters(url, user.id);
    const cursor = url.searchParams.get('cursor') || '9999-12-31';
    dateSchema.parse(cursor);
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(url.searchParams.get('limit') || 30);
    const [records, count] = await env.DB.batch([
      env.DB.prepare(
        `${summarySelect} WHERE ${f.where} AND date < ? ORDER BY date DESC LIMIT ?`,
      ).bind(...f.params, cursor, limit + 1),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM entries WHERE ${f.where}`).bind(...f.params),
    ]);
    const rows = records.results as unknown as SummaryRow[];
    return json({
      entries: rows.slice(0, limit).map(summary),
      nextCursor: rows.length > limit ? rows[limit - 1].date : null,
      total: (count.results[0] as { count: number }).count,
    });
  }
  const match = url.pathname.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})$/);
  if (match) {
    const date = dateSchema.parse(match[1]);
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM entries WHERE owner_id = ? AND date = ?')
        .bind(user.id, date)
        .first<Row>();
      return row ? json(fromRow(row)) : json({ error: 'No entry for this day.' }, 404);
    }
    if (request.method === 'PUT') {
      const { entry, revision } = z
        .object({ entry: entrySchema, revision: z.number().int().min(0) })
        .strict()
        .parse(await readBody(request));
      if (entry.date !== date) error('Entry date and URL do not match.');
      const data = JSON.stringify(entry);
      const operation =
        revision === 0
          ? env.DB.prepare(
              'INSERT INTO entries(owner_id, date, data) VALUES(?, ?, ?) ON CONFLICT(owner_id, date) DO NOTHING',
            ).bind(user.id, date, data)
          : env.DB.prepare(
              "UPDATE entries SET data = ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE owner_id = ? AND date = ? AND revision = ?",
            ).bind(data, user.id, date, revision);
      const [, result] = await env.DB.batch([
        env.DB.prepare('INSERT INTO users(id, email) VALUES(?, ?) ON CONFLICT(id) DO NOTHING').bind(
          user.id,
          user.email,
        ),
        operation,
      ]);
      if (!result.meta.changes)
        error(
          'This entry changed in another session. Reload it before saving to avoid overwriting changes.',
          409,
        );
      return json({ date, revision: revision + 1 }, revision === 0 ? 201 : 200);
    }
    if (request.method === 'DELETE') {
      const revision = z.coerce.number().int().min(1).parse(url.searchParams.get('revision'));
      const result = await env.DB.prepare(
        'DELETE FROM entries WHERE owner_id = ? AND date = ? AND revision = ?',
      )
        .bind(user.id, date, revision)
        .run();
      if (!result.meta.changes)
        error('Entry changed or was already removed. Reload before deleting.', 409);
      return new Response(null, { status: 204 });
    }
  }
  return json({ error: 'Endpoint not found.' }, 404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!/^\/api(?:\/|$)/.test(new URL(request.url).pathname)) return env.ASSETS.fetch(request);
    let response: Response;
    try {
      response = await handleApi(request, env);
    } catch (cause) {
      if (cause instanceof Response) response = cause;
      else if (cause instanceof z.ZodError)
        response = json(
          {
            error: cause.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; '),
          },
          400,
        );
      else {
        console.error('API request failed', {
          path: new URL(request.url).pathname,
          category: cause instanceof Error ? cause.name : 'unknown',
        });
        response = json({ error: 'The request could not be completed. Please try again.' }, 500);
      }
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Vary', 'Cookie');
    if (!headers.has('Content-Type') && response.status !== 204)
      headers.set('Content-Type', 'application/json');
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
