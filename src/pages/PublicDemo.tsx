import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { App } from '../App';
import { ApiError, ApiProvider, networkRequest } from '../lib/api';
import { DemoWorkspace } from '../lib/demo-workspace';
import { AppearanceControl } from '../components/AppearanceControl';
import { ErrorBox, Loading } from '../components/ui';

export function PublicDemo() {
  const [workspace, setWorkspace] = useState<DemoWorkspace | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    async function load() {
      try {
        try {
          await networkRequest('/api/session', { signal: controller.signal });
          if (!controller.signal.aborted) setSignedIn(true);
          return;
        } catch (cause) {
          if (!(cause instanceof ApiError) || cause.status !== 401) throw cause;
        }
        const snapshot = await networkRequest('/api/demo', { signal: controller.signal });
        if (!controller.signal.aborted) setWorkspace(new DemoWorkspace(snapshot));
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Could not load the demo. Please try again.',
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  if (signedIn) return <Navigate to="/" replace />;
  if (workspace)
    return (
      <ApiProvider workspace={workspace}>
        <App />
      </ApiProvider>
    );
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link className="public-brand" to="/">
          Tedd’mhen
        </Link>
        <AppearanceControl />
      </header>
      <main id="main">
        <section className="auth-card">
          <h1>Explore the demo.</h1>
          <p>A complete example journal. No account required.</p>
          {error ? (
            <>
              <ErrorBox message={error} />
              <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </>
          ) : (
            <Loading />
          )}
          <nav className="auth-links" aria-label="Account access">
            <Link to="/sign-in">Sign in</Link>
            <Link to="/register">Create account</Link>
          </nav>
        </section>
      </main>
    </div>
  );
}
