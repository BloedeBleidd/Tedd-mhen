import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { StoredEntry } from '../../shared/schema';
import { DemoWorkspace } from './demo-workspace';
import { ApiError } from './api-error';
export { ApiError } from './api-error';
type ApiContext = {
  demo: boolean;
  demoLoading: boolean;
  demoError: string | null;
  demoRecordCount: number | null;
  toggleDemo: () => void;
  cancelDemoLoad: () => void;
  version: number;
  invalidate: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  getDemoEntries: () => StoredEntry[];
};
const Context = createContext<ApiContext>(null!);
async function networkRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('X-Teddmhen-Request', '1');
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers });
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
export function ApiProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<DemoWorkspace | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const mode = useRef(workspace);
  const pending = useRef<AbortController | null>(null);
  const writes = useRef(0);
  const cancelDemoLoad = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    setDemoLoading(false);
    setDemoError(null);
  }, []);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  const toggleDemo = useCallback(async () => {
    if (pending.current) return;
    setDemoError(null);
    const maySwitch = () => {
      if (
        writes.current ||
        !window.dispatchEvent(new Event('teddmhen:mode-change', { cancelable: true }))
      ) {
        setDemoError(
          'Workspace unchanged. Finish the current operation or resolve unsaved changes first.',
        );
        return false;
      }
      return true;
    };
    if (mode.current) {
      if (!maySwitch()) return;
      mode.current = null;
      setWorkspace(null);
      setVersion((v) => v + 1);
      return;
    }
    if (writes.current) {
      maySwitch();
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setDemoLoading(true);
    try {
      const snapshot = await networkRequest<unknown>('/api/demo', { signal: controller.signal });
      if (pending.current !== controller) return;
      const next = new DemoWorkspace(snapshot);
      if (!maySwitch()) return;
      mode.current = next;
      setWorkspace(next);
      setVersion((v) => v + 1);
    } catch (error) {
      if (pending.current === controller && !controller.signal.aborted)
        setDemoError(
          error instanceof ApiError
            ? error.message
            : 'Could not load the demo. Your journal is unchanged. Please try again.',
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setDemoLoading(false);
      }
    }
  }, []);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (mode.current !== workspace)
        throw new ApiError('Your workspace changed. Reload before continuing.', 409);
      if (workspace) return workspace.request<T>(path, options);
      const mutation = !['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase());
      if (mutation && path.startsWith('/api/auth/')) cancelDemoLoad();
      if (mutation) writes.current++;
      try {
        const result = await networkRequest<T>(path, options);
        if (mode.current !== workspace)
          throw new ApiError('Your workspace changed. Reload before continuing.', 409);
        return result;
      } finally {
        if (mutation) writes.current--;
      }
    },
    [workspace, cancelDemoLoad],
  );
  const getDemoEntries = useCallback(() => {
    if (!workspace || mode.current !== workspace)
      throw new ApiError('Select Demo data before exporting examples.', 409);
    return workspace.snapshot();
  }, [workspace]);
  return (
    <Context.Provider
      value={{
        demo: !!workspace,
        demoLoading,
        demoError,
        demoRecordCount: workspace?.recordCount ?? null,
        toggleDemo,
        cancelDemoLoad,
        version,
        invalidate,
        request,
        getDemoEntries,
      }}
    >
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
