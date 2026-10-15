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
  response: (path: string, options?: RequestInit) => Promise<Response>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  getDemoEntries: () => StoredEntry[];
};
const Context = createContext<ApiContext>(null!);
async function networkResponse(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('X-Teddmhen-Request', '1');
  let response: Response;
  try {
    response = await fetch(path, { ...options, credentials: 'same-origin', headers });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      'Could not reach the server. Check your connection and try again. If you were saving, reload the entry to check whether it was saved.',
      0,
    );
  }
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ error: 'The server returned an unexpected response.' }))) as {
      error?: string;
    };
    throw new ApiError(body.error || 'Request failed.', response.status);
  }
  return response;
}
export async function networkRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await networkResponse(path, options);
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
  const owner = useRef<string | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const response = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      if (!mounted.current || workspace)
        throw new ApiError('This workspace cannot make a live data request.', 409);
      const expected = owner.current;
      const credentials = /^\/api\/auth\/(login|register|recover|claim)$/.test(path);
      if (!expected && path !== '/api/session' && !path.startsWith('/api/auth/'))
        throw new ApiError(
          'Verify your session before accessing your journal. Reload to continue.',
          409,
        );
      const headers = new Headers(options.headers);
      if (expected && !credentials) {
        if (
          headers.has('X-Teddmhen-Expected-User') &&
          headers.get('X-Teddmhen-Expected-User') !== expected
        )
          throw new ApiError('Your signed-in account changed. Reload before continuing.', 403);
        headers.set('X-Teddmhen-Expected-User', expected);
      }
      const result = await networkResponse(path, { ...options, headers });
      if (
        !mounted.current ||
        (!credentials &&
          owner.current !== expected &&
          !(path === '/api/session' && expected === null))
      ) {
        await result.body?.cancel();
        throw new ApiError('Your signed-in account changed. Reload before continuing.', 403);
      }
      return result;
    },
    [workspace],
  );
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!mounted.current)
        throw new ApiError('Your workspace closed. Reload before continuing.', 409);
      if (workspace) return workspace.request<T>(path, options);
      const expected = owner.current;
      const credentials = /^\/api\/auth\/(login|register|recover|claim)$/.test(path);
      const result = await response(path, options);
      const data = (result.status === 204 ? undefined : await result.json()) as
        { id?: string; userId?: string } | undefined;
      const sameInitialSession =
        path === '/api/session' && expected === null && data?.id === owner.current;
      if (!mounted.current || (!credentials && owner.current !== expected && !sameInitialSession))
        throw new ApiError('Your signed-in account changed. Reload before continuing.', 403);
      if (path === '/api/session') owner.current = data?.id ?? null;
      if (/^\/api\/auth\/(login|register|recover|claim|change-password)$/.test(path))
        owner.current = data?.userId ?? null;
      if (/^\/api\/auth\/(logout|delete-account)$/.test(path)) owner.current = null;
      return data as T;
    },
    [workspace, response],
  );
  const getDemoEntries = useCallback(() => {
    if (!workspace || !mounted.current)
      throw new ApiError('Open the demo before exporting examples.', 409);
    return workspace.snapshot();
  }, [workspace]);
  return (
    <Context.Provider
      value={{ demo: !!workspace, version, invalidate, request, response, getDemoEntries }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApi = () => useContext(Context);
export function useLoad<T>(path: string | null, keepDuringRefresh = false) {
  const { request, version } = useApi();
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
    status: number | null;
  }>({
    data: null,
    loading: !!path,
    error: null,
    status: null,
  });
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ data: null, loading: false, error: null, status: null });
      return;
    }
    setState((previous) => ({
      data: keepDuringRefresh ? previous.data : null,
      loading: true,
      error: null,
      status: null,
    }));
    request<T>(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null, status: null });
      })
      .catch((error) => {
        if (active)
          setState((previous) => ({
            data: keepDuringRefresh ? previous.data : null,
            loading: false,
            error: error.message,
            status: error instanceof ApiError ? error.status : 0,
          }));
      });
    return () => {
      active = false;
    };
  }, [path, request, version, keepDuringRefresh, attempt]);
  return { ...state, retry: () => retry((value) => value + 1) };
}
export function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
