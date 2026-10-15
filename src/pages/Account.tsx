import { PendingAccountGuard } from '../components/PendingAccountGuard';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useLoad } from '../lib/api';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
import { loginPassword, passwordSchema } from '../../shared/credentials';
import { RecoverySecret } from './Auth';

export function Account() {
  const { request, invalidate, demo } = useApi();
  const pending = useRef(false);
  const session = useLoad<{ email: string; local: boolean }>('/api/session');
  const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const unavailable = demo || session.data?.local || !session.data;
  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  async function action(kind: 'logout' | 'delete-account' | 'change-password') {
    if (busy) return;
    setError('');
    pending.current = true;
    setBusy(true);
    try {
      const body =
        kind === 'change-password'
          ? { currentPassword, password }
          : kind === 'delete-account'
            ? { currentPassword }
            : {};
      const result = await request<{ recoveryCode?: string }>(`/api/auth/${kind}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      pending.current = false;
      setCurrent('');
      setPassword('');
      setConfirm('');
      if (result.recoveryCode) setSecret(result.recoveryCode);
      else {
        invalidate();
        navigate('/sign-in');
      }
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Unable to complete this request.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function change(event: FormEvent) {
    event.preventDefault();
    const current = loginPassword.safeParse(currentPassword);
    const next = passwordSchema.safeParse(password);
    if (!current.success) {
      showError('Current password: ' + current.error.issues[0].message);
      return;
    }
    if (!next.success) {
      showError('New password: ' + next.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      showError('Passwords do not match.');
      return;
    }
    void action('change-password');
  }
  if (secret)
    return (
      <RecoverySecret
        code={secret}
        onDone={() => {
          setSecret('');
          invalidate();
          navigate('/');
        }}
      />
    );
  return (
    <>
      <PendingAccountGuard pending={pending} />
      <PageHeading
        eyebrow="ACCOUNT & ACCESS"
        title="Your account."
        description="Manage your password, recovery, and saved journal."
      />
      <div ref={errorRef} tabIndex={-1}>
        <ErrorBox message={error || session.error} />
      </div>
      <Panel title={session.data?.email || 'Account'} className="prose-panel">
        <p>
          Email is an unverified sign-in identifier. We do not send messages or password-reset
          emails. Keep your recovery code in a password manager. Changing your password replaces the
          recovery code and signs out other sessions.
        </p>
        {unavailable ? (
          <>
            <p>
              {demo
                ? 'Create an account to save your own journal. Demo changes are temporary and will not be transferred.'
                : session.data?.local
                  ? 'Account changes are unavailable in the local development bypass.'
                  : 'Account details are unavailable. Reload or sign in again before making changes.'}
            </p>
            {demo && (
              <Link className="button primary" to="/register">
                Create account
              </Link>
            )}
          </>
        ) : (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void action('logout')}
          >
            Sign out
          </button>
        )}
      </Panel>
      {!unavailable && (
        <Panel title="Password & recovery" className="prose-panel">
          <form noValidate className="auth-form" onSubmit={change}>
            <fieldset className="form-fieldset auth-form" disabled={busy}>
              <Field label="Current password">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
              </Field>
              <Field
                label="New password"
                hint="12–128 characters. Changing it also replaces your recovery code."
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </Field>
              <button className="button primary" disabled={busy}>
                Change password & recovery code
              </button>
            </fieldset>
          </form>
          <div className="account-delete">
            <h3>Delete account and journal</h3>
            <p>
              Export anything you want to keep first. This deletes your account, sessions, and all
              journal entries from the active database. Backups and downloaded exports may retain
              copies as described in Privacy & data.
            </p>
            <button
              className="button danger"
              disabled={busy || !currentPassword}
              onClick={() => {
                if (
                  window.confirm(
                    'Permanently delete your account and every journal entry? This cannot be undone in the app.',
                  )
                )
                  void action('delete-account');
              }}
            >
              Delete account and all entries
            </button>
            <p className="small muted">Enter your current password above to enable deletion.</p>
          </div>
        </Panel>
      )}
    </>
  );
}
