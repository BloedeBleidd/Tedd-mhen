import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { entrySchema, summarize, type StoredEntry } from '../../shared/schema';
import { makeDemo } from './demo';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type ApiContext = {
  demo: boolean;
  toggleDemo: () => void;
  version: number;
  invalidate: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  demoEntries: StoredEntry[];
};
const Context = createContext<ApiContext>(null!);
export function ApiProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(false),
    [demoEntries, setDemoEntries] = useState<StoredEntry[]>([]),
    [version, setVersion] = useState(0);
  const toggleDemo = useCallback(() => {
    if (!window.dispatchEvent(new Event('teddmhen:mode-change', { cancelable: true }))) return;
    setDemo((v) => !v);
    setDemoEntries(makeDemo());
    setVersion((v) => v + 1);
  }, []);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!demo) {
        const response = await fetch(path, {
          ...options,
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-Teddmhen-Request': '1',
            ...options.headers,
          },
        });
        if (!response.ok) {
          const body = (await response
            .json()
            .catch(() => ({ error: 'The server returned an unexpected response.' }))) as {
            error?: string;
          };
          throw new ApiError(body.error || 'Request failed.', response.status);
        }
        return response.status === 204 ? (undefined as T) : response.json();
      }
      const url = new URL(path, window.location.origin),
        date = url.pathname.match(/\/entries\/(.+)$/)?.[1];
      if (url.pathname === '/api/session') return { email: 'Demo workspace', local: false } as T;
      if (date) {
        const existing = demoEntries.find((e) => e.date === date);
        if (options.method === 'PUT') {
          const { entry, revision } = JSON.parse(options.body as string);
          entrySchema.parse(entry);
          if ((existing?.revision ?? 0) !== revision)
            throw new ApiError('Entry changed. Reload before saving.', 409);
          const next = {
            ...entry,
            revision: revision + 1,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setDemoEntries((entries) => [...entries.filter((e) => e.date !== date), next]);
          return { date, revision: next.revision } as T;
        }
        if (options.method === 'DELETE') {
          setDemoEntries((entries) => entries.filter((e) => e.date !== date));
          return undefined as T;
        }
        if (!existing) throw new ApiError('No entry for this day.', 404);
        return existing as T;
      }
      const from = url.searchParams.get('from') || '',
        to = url.searchParams.get('to') || '9999',
        q = url.searchParams.get('q')?.toLowerCase(),
        type = url.searchParams.get('type'),
        illness = url.searchParams.get('illness');
      const selected = demoEntries.filter(
        (e) =>
          e.date >= from &&
          e.date <= to &&
          (!q || JSON.stringify(e).toLowerCase().includes(q)) &&
          (!type || e.workouts.some((w) => w.type === type)) &&
          (illness !== 'yes' || (e.illnessSeverity ?? 0) > 0 || e.symptoms.length > 0) &&
          (illness !== 'no' || e.illnessSeverity === 0),
      );
      if (url.pathname === '/api/series')
        return {
          entries: selected.sort((a, b) => a.date.localeCompare(b.date)).map(summarize),
        } as T;
      const cursor = url.searchParams.get('cursor') || '9999',
        limit = Number(url.searchParams.get('limit') || 30);
      const rows = selected
        .filter((e) => e.date < cursor)
        .sort((a, b) => b.date.localeCompare(a.date));
      return {
        entries: rows.slice(0, limit).map(summarize),
        total: selected.length,
        nextCursor: rows.length > limit ? rows[limit - 1].date : null,
      } as T;
    },
    [demo, demoEntries],
  );
  return (
    <Context.Provider value={{ demo, toggleDemo, version, invalidate, request, demoEntries }}>
      {children}
    </Context.Provider>
  );
}
export const useApi = () => useContext(Context);
export function useLoad<T>(path: string | null, keepDuringRefresh = false) {
  const { request, version } = useApi();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: !!path,
    error: null,
  });
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((previous) => ({
      data: keepDuringRefresh ? previous.data : null,
      loading: true,
      error: null,
    }));
    request<T>(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [path, request, version, keepDuringRefresh]);
  return state;
}
export function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
