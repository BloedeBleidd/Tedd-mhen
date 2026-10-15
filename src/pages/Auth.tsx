import { useId, useRef, useState, type FormEvent } from 'react';
import { validateAuthForm, type AuthField } from '../../shared/credentials';
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
  const [privacy, setPrivacy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<AuthField, boolean>>>({});
  const errorRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const issues = validateAuthForm(mode, { email, password, confirm, code, privacy });
  const visibleIssue = (field: AuthField) =>
    attempted || touched[field] ? issues[field] : undefined;
  const attributes = (field: AuthField, label: string) => ({
    name: field,
    'aria-label': label,
    'aria-invalid': Boolean(visibleIssue(field)),
    'aria-describedby':
      [
        field === 'password' && mode !== 'login' ? `${id}-password-hint` : '',
        visibleIssue(field) ? `${id}-${field}-error` : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    onBlur: () => setTouched((previous) => ({ ...previous, [field]: true })),
  });
  const feedback = (field: AuthField) =>
    visibleIssue(field) ? (
      <small id={`${id}-${field}-error`} className="field-error">
        {visibleIssue(field)}
      </small>
    ) : null;
  const finish = () => {
    setSecret('');
    setPassword('');
    invalidate();
    navigate('/');
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setAttempted(true);
    const first = Object.keys(issues)[0];
    if (first) {
      const input = event.currentTarget.elements.namedItem(first) as HTMLInputElement | null;
      requestAnimationFrame(() => {
        input?.focus();
        input?.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
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
      requestAnimationFrame(() => {
        errorRef.current?.focus();
        errorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
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
      <form noValidate onSubmit={submit} className="auth-form" aria-busy={busy}>
        {mode !== 'claim' && (
          <Field label="Email">
            <input
              {...attributes('email', 'Email')}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
            {feedback('email')}
          </Field>
        )}
        {mode === 'recover' && (
          <Field label="Recovery code">
            <input
              {...attributes('code', 'Recovery code')}
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="TMH-…"
              maxLength={100}
            />
            {feedback('code')}
          </Field>
        )}
        <Field label={mode === 'login' ? 'Password' : 'New password'}>
          <input
            {...attributes('password', mode === 'login' ? 'Password' : 'New password')}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'login' ? 1 : 12}
            maxLength={128}
          />
          {mode !== 'login' && (
            <small id={`${id}-password-hint`}>
              12–128 characters. A long, unique passphrase works well.{' '}
              {password.length > 0 &&
                `${password.length} entered${password.length < 12 ? ` · ${12 - password.length} more needed` : ''}.`}
            </small>
          )}
          {feedback('password')}
        </Field>
        {mode !== 'login' && (
          <Field label="Confirm password">
            <input
              {...attributes('confirm', 'Confirm password')}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
              maxLength={128}
            />
            {feedback('confirm')}
          </Field>
        )}
        {mode === 'register' && (
          <div>
            <label className="check-label">
              <input
                name="privacy"
                type="checkbox"
                required
                checked={privacy}
                onChange={(event) => setPrivacy(event.target.checked)}
                aria-invalid={Boolean(visibleIssue('privacy'))}
                aria-describedby={visibleIssue('privacy') ? `${id}-privacy-error` : undefined}
              />{' '}
              <span>
                I have read <Link to="/privacy">Privacy & data</Link>. I understand that email
                addresses are not verified and account recovery requires my saved code.
              </span>
            </label>
            {feedback('privacy')}
          </div>
        )}
        {attempted && Object.keys(issues).length > 0 && (
          <div className="notice error" role="alert">
            Check the highlighted fields. {Object.values(issues)[0]}
          </div>
        )}
        <div ref={errorRef} tabIndex={-1}>
          <ErrorBox message={error || null} />
        </div>
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
