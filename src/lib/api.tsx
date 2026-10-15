import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  version: number;
  invalidate: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  getDemoEntries: () => StoredEntry[];
};
const Context = createContext<ApiContext>(null!);
export async function networkRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
export function ApiProvider({
  children,
  workspace = null,
}: {
  children: ReactNode;
  workspace?: DemoWorkspace | null;
}) {
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!mounted.current)
        throw new ApiError('Your workspace closed. Reload before continuing.', 409);
      if (workspace) return workspace.request<T>(path, options);
      const result = await networkRequest<T>(path, options);
      if (!mounted.current)
        throw new ApiError('Your workspace closed. Reload before continuing.', 409);
      return result;
    },
    [workspace],
  );
  const getDemoEntries = useCallback(() => {
    if (!workspace || !mounted.current)
      throw new ApiError('Open the demo before exporting examples.', 409);
    return workspace.snapshot();
  }, [workspace]);
  return (
    <Context.Provider value={{ demo: !!workspace, version, invalidate, request, getDemoEntries }}>
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
