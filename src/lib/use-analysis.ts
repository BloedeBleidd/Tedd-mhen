import { useEffect, useState } from 'react';
import type { AnalysisJob } from './analysis-worker';
export function useAnalysis<T>(job: AnalysisJob | null) {
  const [state, setState] = useState<{ result: T | null; error: string | null; busy: boolean }>({
    result: null,
    error: null,
    busy: false,
  });
  useEffect(() => {
    if (!job) {
      setState({ result: null, error: null, busy: false });
      return;
    }
    setState({ result: null, error: null, busy: true });
    const worker = new Worker(new URL('./analysis-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ result?: T; error?: string }>) =>
      setState({ result: event.data.result ?? null, error: event.data.error ?? null, busy: false });
    worker.onerror = () =>
      setState({
        result: null,
        error: 'Analysis worker failed. Try fewer inputs or a shorter date range.',
        busy: false,
      });
    worker.postMessage(job);
    return () => worker.terminate();
  }, [job]);
  return state;
}
