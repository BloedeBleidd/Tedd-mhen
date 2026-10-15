import { emptyEntry, entrySchema, dateSchema, type Entry } from './schema';
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Invalid JSON.');
  }
}

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export type ImportRow = { date: string; fields: Record<string, unknown> };
const metadata = new Set([
  'schemaVersion',
  'date',
  'timezone',
  'revision',
  'createdAt',
  'updatedAt',
]);
const allowed = new Set(Object.keys(emptyEntry()));
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
      continue;
    }
    if (closed && ![',', '\r', '\n'].includes(c))
      throw new Error('Unexpected text after a quoted CSV field.');
    if (c === '"') {
      if (value) throw new Error('Unexpected quote in CSV.');
      quoted = true;
    } else if (c === ',') {
      row.push(value);
      value = '';
      closed = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      closed = false;
    } else value += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (value || row.length || closed) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
function csvRows(text: string) {
  const [headers, ...rows] = parseCsv(text);
  if (!headers?.length || !headers.includes('date')) throw new Error('CSV requires a date column.');
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV columns.');
  const template = emptyEntry();
  return rows
    .filter((row) => row.some(Boolean))
    .map((row, index) => {
      if (row.length !== headers.length)
        throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
      const result: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        const path = headers[i],
          parts = path.split('.'),
          root = parts[0],
          key = parts[1],
          raw = row[i];
        if (
          parts.length > 2 ||
          (key && metadata.has(root)) ||
          (!allowed.has(root) && !metadata.has(root))
        )
          throw new Error(`Unsupported CSV column: ${path}`);
        if (root === 'schemaVersion' && raw && raw !== '1')
          throw new Error('Unsupported schema version.');
        if (metadata.has(root) && root !== 'timezone' && root !== 'date') continue;
        let value: unknown = raw;
        if (['labels', 'symptoms', 'workouts'].includes(root))
          value = raw ? parseJson(raw) : root === 'labels' ? null : [];
        else if (
          root === 'date' ||
          root === 'timezone' ||
          root === 'trainingStatus' ||
          root.endsWith('Notes') ||
          root === 'notes' ||
          ['bedtime', 'wakeTime', 'hrvMethod', 'source'].includes(key)
        )
          value = raw || (['bedtime', 'wakeTime'].includes(key) ? null : raw);
        else {
          if (!raw.trim()) value = null;
          else {
            value = Number(raw);
            if (!Number.isFinite(value)) throw new Error(`Invalid number in ${path}.`);
          }
        }
        if (key) {
          const shape = template[root as keyof Entry];
          if (
            !shape ||
            typeof shape !== 'object' ||
            Array.isArray(shape) ||
            !Object.hasOwn(shape, key)
          )
            throw new Error(`Unsupported CSV column: ${path}`);
          ((result[root] ??= {}) as Record<string, unknown>)[key] = value;
        } else result[root] = value;
      }
      return result;
    });
}
export function mergeImported(row: ImportRow, existing?: Entry): Entry {
  const base = emptyEntry(row.date);
  if (existing)
    for (const key of allowed)
      if (Object.hasOwn(existing, key))
        (base as Record<string, unknown>)[key] = structuredClone(
          (existing as Record<string, unknown>)[key],
        );
  const fields = row.fields;
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.has(key) || key === 'schemaVersion' || key === 'date') continue;
    if (key === 'sleep' || key === 'physiology') {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`Invalid ${key} object.`);
      for (const nested of Object.keys(value))
        if (!Object.hasOwn(base[key], nested))
          throw new Error(`Unsupported ${key} field: ${nested}`);
      Object.assign(base[key], value);
    } else if (key === 'workouts') {
      if (!Array.isArray(value)) throw new Error('Workouts must be an array.');
      base.workouts = value.map((item) => {
        if (!item || typeof item !== 'object') throw new Error('Invalid workout.');
        return {
          ...item,
          notes: Object.hasOwn(item, 'notes')
            ? item.notes
            : (existing?.workouts.find((w) => w.id === item.id)?.notes ?? ''),
        };
      });
      if (!Object.hasOwn(fields, 'trainingStatus'))
        base.trainingStatus = base.workouts.length ? 'trained' : 'unrecorded';
    } else (base as Record<string, unknown>)[key] = value;
  }
  const parsed = entrySchema.safeParse(base);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
  if (
    new TextEncoder().encode(JSON.stringify({ entry: parsed.data, revision: 0 })).length >
    256 * 1024
  )
    throw new Error('Daily entry exceeds the 256 KiB request limit.');
  return parsed.data;
}
export function parseImport(text: string, format: 'json' | 'ndjson' | 'csv'): ImportRow[] {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES)
    throw new Error('Choose a file smaller than 20 MiB.');
  const clean = text.replace(/^\uFEFF/, '');
  const validateMetadata = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid export metadata.');
    if ('schemaVersion' in value && value.schemaVersion !== 1)
      throw new Error('Unsupported schema version.');
  };
  let records: unknown;
  if (format === 'csv') records = csvRows(clean);
  else if (format === 'ndjson')
    records = clean
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => parseJson(line))
      .filter((row, index) => {
        if (row && typeof row === 'object' && '_meta' in row) {
          if (index !== 0 || Object.keys(row).length !== 1)
            throw new Error('NDJSON metadata must occupy the first line by itself.');
          validateMetadata(row._meta);
          return false;
        }
        return true;
      });
  else {
    const parsed = parseJson(clean);
    if (!Array.isArray(parsed)) validateMetadata(parsed);
    records = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>).entries;
  }
  if (!Array.isArray(records) || !records.length)
    throw new Error('No observations found. Use a Tedd’mhen JSON, NDJSON or CSV export.');
  if (records.length > IMPORT_MAX_ROWS)
    throw new Error(`Import up to ${IMPORT_MAX_ROWS} days per file.`);
  const dates = new Set<string>();
  return records.map((record, index) => {
    try {
      if (!record || typeof record !== 'object' || Array.isArray(record))
        throw new Error('Expected an observation object.');
      for (const key of Object.keys(record))
        if (!allowed.has(key) && !metadata.has(key)) throw new Error(`Unsupported field: ${key}`);
      if (record.schemaVersion !== undefined && record.schemaVersion !== 1)
        throw new Error('Unsupported schema version.');
      const date = dateSchema.parse(record.date);
      if (dates.has(date))
        throw new Error(`Duplicate date ${date}; combine it explicitly before import.`);
      dates.add(date);
      const fields = Object.fromEntries(
        Object.entries(record).filter(
          ([key]) => allowed.has(key) && !['schemaVersion', 'date'].includes(key),
        ),
      );
      if (!Object.keys(fields).length) throw new Error('No recorded fields to import.');
      const row = { date, fields };
      // Validate only supplied fields; omitted fields may come from an existing day at merge time.
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'sleep' || key === 'physiology') entrySchema.shape[key].partial().parse(value);
        else if (key === 'workouts') {
          if (!Array.isArray(value)) throw new Error('Workouts must be an array.');
          const normalized = value.map((item) => ({ ...item, notes: item.notes ?? '' }));
          entrySchema.parse({
            ...emptyEntry(date),
            workouts: normalized,
            trainingStatus: fields.trainingStatus ?? (normalized.length ? 'trained' : 'unrecorded'),
          });
        } else entrySchema.shape[key as keyof typeof entrySchema.shape].parse(value);
      }
      if (fields.illnessSeverity === 0 && Array.isArray(fields.symptoms) && fields.symptoms.length)
        throw new Error('Symptoms conflict with zero illness severity.');
      return row;
    } catch (error) {
      throw new Error(
        `Observation ${index + 1}: ${error instanceof Error ? error.message : 'invalid data'}`,
      );
    }
  });
}
