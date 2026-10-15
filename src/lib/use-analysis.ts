import { useEffect, useState } from 'react';
import type { AnalysisJob } from './analysis-worker';
export function useAnalysis<T>(job: AnalysisJob | null) {
  const [state, setState] = useState<{
    job: AnalysisJob | null;
    result: T | null;
    error: string | null;
    busy: boolean;
  }>({
    job: null,
    result: null,
    error: null,
    busy: false,
  });
  useEffect(() => {
    if (!job) {
      setState({ job, result: null, error: null, busy: false });
      return;
    }
    let active = true;
    let worker: Worker | undefined;
    const fail = () => {
      if (active)
        setState({
          job,
          result: null,
          error:
            'Analysis could not run. Try fewer inputs, a shorter date range, or reload the page.',
          busy: false,
        });
    };
    setState({ job, result: null, error: null, busy: true });
    try {
      worker = new Worker(new URL('./analysis-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ result?: T; error?: string }>) => {
        if (active)
          setState({
            job,
            result: event.data.result ?? null,
            error: event.data.error ?? null,
            busy: false,
          });
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.postMessage(job);
    } catch {
      fail();
    }
    return () => {
      active = false;
      worker?.terminate();
    };
  }, [job]);
  return state.job === job ? state : { result: null, error: null, busy: !!job };
}
