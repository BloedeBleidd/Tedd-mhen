import { habitDefinitionSchema, habitKeySchema, type HabitDefinition } from '../../shared/habits';
import { z } from 'zod';
import { DEMO_DATASET } from '../../shared/demo';
import {
  dateSchema,
  dayNumber,
  entrySchema,
  localDate,
  shiftDate,
  summarize,
  workoutTypes,
  type StoredEntry,
} from '../../shared/schema';
import { ApiError } from './api-error';

const storedEntrySchema = entrySchema.safeExtend({
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const snapshotSchema = z
  .object({
    id: z.literal(DEMO_DATASET),
    title: z.string().min(1).max(200),
    anchorDate: dateSchema,
    recordCount: z.number().int().min(1).max(500),
    entries: z.array(storedEntrySchema).min(1).max(500),
  })
  .strict()
  .refine(
    (value) =>
      value.entries.length === value.recordCount &&
      new Set(value.entries.map((entry) => entry.date)).size === value.recordCount &&
      value.entries.every((entry) => entry.date <= value.anchorDate) &&
      value.entries.some((entry) => entry.date === value.anchorDate),
    'The demo snapshot is incomplete.',
  );

export class DemoWorkspace {
  readonly title: string;
  readonly id: string;
  readonly recordCount: number;
  private definitions = new Map<string, HabitDefinition>();
  private rows: Map<string, StoredEntry>;
  constructor(
    snapshot: unknown,
    readonly today = localDate(),
  ) {
    const value = snapshotSchema.parse(snapshot);
    dateSchema.parse(today);
    this.id = 'demo:guest';
    this.title = value.title;
    this.recordCount = value.recordCount;
    const days = dayNumber(today) - dayNumber(value.anchorDate);
    const timestamp = (time: string) =>
      new Date(Date.parse(time) + days * 86_400_000).toISOString();
    this.rows = new Map(
      value.entries.map((entry) => {
        const shifted = {
          ...entry,
          date: shiftDate(entry.date, days),
          createdAt: timestamp(entry.createdAt),
          updatedAt: timestamp(entry.updatedAt),
        };
        return [shifted.date, shifted];
      }),
    );
    for (const entry of this.rows.values()) this.remember(entry);
  }
  private remember(entry: StoredEntry) {
    for (const habit of entry.habits || [])
      if (habit.name && !this.definitions.has(habit.key))
        this.definitions.set(habit.key, { key: habit.key, name: habit.name, archived: false });
  }
  snapshot(): StoredEntry[] {
    return structuredClone([...this.rows.values()]);
  }
  request<T>(path: string, options: RequestInit = {}): T {
    try {
      return this.handle(path, options) as T;
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        throw new ApiError('Check the demo entry or filter values and try again.', 400);
      throw error;
    }
  }
  private handle(path: string, options: RequestInit) {
    if (!path.startsWith('/api/')) throw new ApiError('Endpoint not found.', 404);
    const url = new URL(path, 'https://demo.invalid');
    const method = (options.method || 'GET').toUpperCase();
    const expectedUser = new Headers(options.headers).get('X-Teddmhen-Expected-User');
    if (expectedUser && expectedUser !== this.id)
      throw new ApiError('Your workspace changed. Reload before continuing.', 403);
    if (url.pathname.startsWith('/api/admin/'))
      throw new ApiError('Administration is unavailable in the synthetic demo.', 403);
    if (url.pathname.startsWith('/api/auth/'))
      throw new ApiError('Sign in or create an account to manage your own journal.', 403);
    if (url.pathname === '/api/session' && method === 'GET')
      return { id: this.id, email: 'Demo workspace', local: false, admin: false };
    if (url.pathname === '/api/habit-definitions') {
      if (method === 'GET') return { definitions: structuredClone([...this.definitions.values()]) };
      if (method === 'PUT') {
        const definition = habitDefinitionSchema.parse(JSON.parse(String(options.body)));
        this.definitions.set(definition.key, definition);
        return structuredClone(definition);
      }
    }
    const match = url.pathname.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})$/);
    if (match) {
      const date = dateSchema.parse(match[1]);
      const existing = this.rows.get(date);
      if (method === 'GET') {
        if (!existing) throw new ApiError('No entry for this day.', 404);
        return structuredClone(existing);
      }
      if (method === 'PUT') {
        const { entry, revision } = z
          .object({ entry: entrySchema, revision: z.number().int().min(0) })
          .strict()
          .parse(JSON.parse(String(options.body)));
        if (entry.date !== date) throw new ApiError('Entry date and URL do not match.', 400);
        if ((existing?.revision ?? 0) !== revision)
          throw new ApiError('Entry changed. Reload before saving.', 409);
        const now = new Date().toISOString();
        this.rows.set(date, {
          ...entry,
          revision: revision + 1,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        });
        this.remember(this.rows.get(date)!);
        return { date, revision: revision + 1 };
      }
      if (method === 'DELETE') {
        const revision = z.coerce.number().int().positive().parse(url.searchParams.get('revision'));
        if (existing?.revision !== revision)
          throw new ApiError('Entry changed or was already removed. Reload before deleting.', 409);
        this.rows.delete(date);
        return;
      }
    }
    if (!['/api/entries', '/api/series'].includes(url.pathname) || method !== 'GET')
      throw new ApiError('Endpoint not found.', 404);
    const series = url.pathname === '/api/series';
    const all = series && url.searchParams.get('all') === 'true';
    const from = dateSchema.parse(
      all
        ? '1900-01-01'
        : url.searchParams.get('from') || (series ? shiftDate(this.today, -89) : '1900-01-01'),
    );
    const to = dateSchema.parse(
      all ? '2200-12-31' : url.searchParams.get('to') || (series ? this.today : '2200-12-31'),
    );
    if (from > to || (series && !all && dayNumber(to) - dayNumber(from) > 1830))
      throw new ApiError(
        'Select a valid range of up to five years, or use All recorded dates.',
        400,
      );
    const q = z
      .string()
      .max(200)
      .parse(url.searchParams.get('q') || '')
      .toLowerCase();
    const type = url.searchParams.get('type');
    if (type) z.enum(workoutTypes).parse(type);
    const habit = url.searchParams.get('habit');
    if (habit) habitKeySchema.parse(habit);
    const illness = z.enum(['', 'all', 'yes', 'no']).parse(url.searchParams.get('illness') || '');
    const selected = [...this.rows.values()].filter(
      (entry) =>
        entry.date >= from &&
        entry.date <= to &&
        (!q || JSON.stringify(entry).toLowerCase().includes(q)) &&
        (!type || entry.workouts.some((workout) => workout.type === type)) &&
        (!habit || entry.habits.some((record) => record.key === habit)) &&
        (illness !== 'yes' || (entry.illnessSeverity ?? 0) > 0 || entry.symptoms.length > 0) &&
        (illness !== 'no' || entry.illnessSeverity === 0),
    );
    if (series)
      return {
        entries: structuredClone(
          selected.sort((a, b) => a.date.localeCompare(b.date)).map(summarize),
        ),
      };
    const cursor = dateSchema.parse(url.searchParams.get('cursor') || '9999-12-31');
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(url.searchParams.get('limit') || 30);
    const rows = selected
      .filter((entry) => entry.date < cursor)
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      entries: structuredClone(rows.slice(0, limit).map(summarize)),
      total: selected.length,
      firstDate: selected.map((entry) => entry.date).sort()[0] ?? null,
      lastDate:
        selected
          .map((entry) => entry.date)
          .sort()
          .at(-1) ?? null,
      nextCursor: rows.length > limit ? rows[limit - 1].date : null,
    };
  }
}
