import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/api';
import { ErrorBox, Field } from '../components/ui';

export function RecoverySecret({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section className="auth-card panel">
      <h1>Save your recovery code.</h1>
      <p>
        This code is shown only now. Store it in your password manager, separately from your
        password. Anyone with this code and your email can reset your account password.
      </p>
      <output className="recovery-secret" aria-label="Recovery code">
        {code}
      </output>
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy recovery code'}
      </button>
      <p>
        The code is single-use. Recovery or a password change replaces it and signs out older
        sessions. We do not send reset emails. Without your password or this code, access cannot be
        recovered through the app.
      </p>
      <label className="check-label">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have
        saved my recovery code somewhere safe.
      </label>
      <button className="button primary" disabled={!saved} onClick={onDone}>
        Continue to my journal
      </button>
    </section>
  );
}

export function AuthPage() {
  const { request, invalidate } = useApi();
  const location = useLocation(),
    navigate = useNavigate();
  const mode =
    location.pathname === '/register'
      ? 'register'
      : location.pathname === '/recover'
        ? 'recover'
        : location.pathname === '/api/auth/claim'
          ? 'claim'
          : 'login';
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [code, setCode] = useState('');
  const [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const finish = () => {
    setSecret('');
    setPassword('');
    invalidate();
    navigate('/');
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (mode !== 'login' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const body =
        mode === 'claim'
          ? { password }
          : mode === 'recover'
            ? { email, password, code }
            : { email, password };
      const result = await request<{ recoveryCode?: string }>(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setPassword('');
      setConfirm('');
      setCode('');
      if (result.recoveryCode) setSecret(result.recoveryCode);
      else finish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete this request.');
    } finally {
      setBusy(false);
    }
  }
  if (secret) return <RecoverySecret code={secret} onDone={finish} />;
  return (
    <section className="auth-card panel">
      <p className="eyebrow">YOUR PERSONAL OBSERVATORY</p>
      <h1>
        {mode === 'register'
          ? 'Make room for your rhythm.'
          : mode === 'recover'
            ? 'Recover your account.'
            : mode === 'claim'
              ? 'Set up your journal account.'
              : 'Welcome back.'}
      </h1>
      <p>
        {mode === 'claim'
          ? 'Your existing owner identity has been checked by Cloudflare. Choose a password to keep your current journal and use email sign-in from now on.'
          : mode === 'register'
            ? 'Your own account. Your own private training and recovery journal.'
            : mode === 'recover'
              ? 'Use your email and saved recovery code to set a new password. The old code and all previous sessions will stop working.'
              : 'Sign in with your email and password.'}
      </p>
      <form onSubmit={submit} className="auth-form">
        {mode !== 'claim' && (
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </Field>
        )}
        {mode === 'recover' && (
          <Field label="Recovery code">
            <input
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="TMH-…"
              maxLength={100}
            />
          </Field>
        )}
        <Field
          label={mode === 'login' ? 'Password' : 'New password'}
          hint={
            mode !== 'login'
              ? '12–128 characters. A long, unique passphrase works well.'
              : undefined
          }
        >
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'login' ? 1 : 12}
            maxLength={128}
          />
        </Field>
        {mode !== 'login' && (
          <Field label="Confirm password">
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
              maxLength={128}
            />
          </Field>
        )}
        {mode === 'register' && (
          <label className="check-label">
            <input type="checkbox" required />{' '}
            <span>
              I have read <Link to="/privacy">Privacy & data</Link>. I understand that email
              addresses are not verified and account recovery requires my saved code.
            </span>
          </label>
        )}
        <ErrorBox message={error || null} />
        <button className="button primary" disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'register'
              ? 'Create account'
              : mode === 'recover'
                ? 'Reset password'
                : mode === 'claim'
                  ? 'Create password & keep my journal'
                  : 'Sign in'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/sign-in">Sign in</Link>
        <Link to="/register">Create an account</Link>
        <Link to="/recover">Recover account</Link>
      </div>
      {mode === 'register' && (
        <p className="small muted">
          Pilot access is free. Cloudflare storage and traffic quotas apply; there is no
          unlimited-hosting promise. Email is a login identifier, not proof of identity.
        </p>
      )}
    </section>
  );
}
