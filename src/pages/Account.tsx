import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useLoad } from '../lib/api';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
import { RecoverySecret } from './Auth';

export function Account() {
  const { request, invalidate, demo, toggleDemo } = useApi();
  const session = useLoad<{ email: string; local: boolean }>('/api/session');
  const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const unavailable = demo || session.data?.local;
  async function action(kind: 'logout' | 'delete-account' | 'change-password') {
    setError('');
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
      setCurrent('');
      setPassword('');
      setConfirm('');
      if (result.recoveryCode) setSecret(result.recoveryCode);
      else {
        invalidate();
        navigate('/sign-in');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete this request.');
    } finally {
      setBusy(false);
    }
  }
  function change(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
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
      <PageHeading
        eyebrow="ACCOUNT & ACCESS"
        title="Your account."
        description="Manage your password, recovery, and saved journal."
      />
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
                ? 'You are exploring a temporary demo workspace. Switch to My data to manage your account.'
                : 'Account changes are unavailable in the local development bypass.'}
            </p>
            {demo && (
              <button className="button primary" onClick={toggleDemo}>
                Back to my account
              </button>
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
          <form className="auth-form" onSubmit={change}>
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
            <Field label="New password">
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
          </form>
          <ErrorBox message={error || null} />
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
