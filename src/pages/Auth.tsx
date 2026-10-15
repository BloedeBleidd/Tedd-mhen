import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { localize, t as tr } from '../i18n';
import { PendingAccountGuard } from '../components/PendingAccountGuard';
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { validateAuthForm, type AuthField } from '../../shared/credentials';
import { Link, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/api';
import { ErrorBox, Field } from '../components/ui';

export function RecoverySecret({ code, onDone }: { code: string; onDone: () => void }) {
  useTranslation();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const blocker = useBlocker(!saved);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(tr('auth:haveYouSavedYourRecoveryCodeLeavingHidesIt'))) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (saved) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [saved]);
  return (
    <section className="auth-card panel">
      <h1>{tr('auth:saveYourRecoveryCode')}</h1>
      <p>{tr('auth:thisCodeIsShownOnlyNowStoreItIn')}</p>
      <output className="recovery-secret" aria-label={tr('auth:recoveryCode')}>
        {code}
      </output>
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setCopyError('');
          } catch {
            setCopied(false);
            setCopyError('auth:copyIsUnavailableInThisBrowserSelectTheCode');
          }
        }}
      >
        {copied ? tr('auth:copied') : tr('auth:copyRecoveryCode')}
      </button>
      <ErrorBox message={copyError || null} />
      <p>{tr('auth:theCodeIsSingleUseRecoveryOrAPassword')}</p>
      <label className="check-label">
        <Trans
          i18nKey="auth:iHaveSavedMyRecoveryCodeSomewhereSafe"
          components={{
            slot0: (
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            ),
          }}
        />
      </label>
      <button className="button primary" disabled={!saved} onClick={onDone}>
        {tr('auth:continueToMyJournal')}
      </button>
    </section>
  );
}

export function AuthPage() {
  useTranslation();
  const { request, invalidate } = useApi();
  const pending = useRef(false);
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
  useLayoutEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
    errorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [error]);
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
        {localize(visibleIssue(field))}
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
      input?.focus();
      input?.scrollIntoView({ block: 'center', behavior: 'instant' });
      return;
    }
    pending.current = true;
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
      pending.current = false;
      setPassword('');
      setConfirm('');
      setCode('');
      if (result.recoveryCode) setSecret(result.recoveryCode);
      else finish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'auth:unableToCompleteThisRequest');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (secret) return <RecoverySecret code={secret} onDone={finish} />;
  return (
    <section className="auth-card panel">
      <p className="eyebrow">{tr('auth:yourPersonalObservatory')}</p>
      <h1>
        {mode === 'register'
          ? tr('auth:makeRoomForYourRhythm')
          : mode === 'recover'
            ? tr('auth:recoverYourAccount')
            : mode === 'claim'
              ? tr('auth:setUpYourJournalAccount')
              : tr('auth:welcomeBack')}
      </h1>
      <p>
        {mode === 'claim'
          ? tr('auth:yourExistingOwnerIdentityHasBeenCheckedByCloudflare')
          : mode === 'register'
            ? tr('auth:yourOwnAccountYourOwnPrivateTrainingAndRecovery')
            : mode === 'recover'
              ? tr('auth:useYourEmailAndSavedRecoveryCodeToSet')
              : tr('auth:signInWithYourEmailAndPassword')}
      </p>
      {mode !== 'claim' && (
        <Link className="auth-demo-link button secondary" to="/demo">
          {tr('auth:tryDemoNoAccountNeeded')}
        </Link>
      )}
      <PendingAccountGuard pending={pending} />
      <form noValidate onSubmit={submit} className="auth-form" aria-busy={busy}>
        <fieldset className="form-fieldset auth-form" disabled={busy}>
          {mode !== 'claim' && (
            <Field label={tr('auth:email')}>
              <input
                {...attributes('email', tr('auth:email'))}
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
            <Field label={tr('auth:recoveryCode')}>
              <input
                {...attributes('code', tr('auth:recoveryCode'))}
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
          <Field label={mode === 'login' ? tr('auth:password') : tr('auth:newPassword')}>
            <input
              {...attributes(
                'password',
                mode === 'login' ? tr('auth:password') : tr('auth:newPassword'),
              )}
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
                <Trans
                  i18nKey="auth:12128CharactersALongUniquePassphraseWorksWell"
                  components={{
                    slot0: (
                      <MessageValue
                        value={
                          password.length > 0 &&
                          tr('auth:entered', {
                            value0: password.length,
                            value1:
                              password.length < 12
                                ? tr('auth:moreNeeded', { value0: 12 - password.length })
                                : '',
                          })
                        }
                      />
                    ),
                  }}
                />
              </small>
            )}
            {feedback('password')}
          </Field>
          {mode !== 'login' && (
            <Field label={tr('auth:confirmPassword')}>
              <input
                {...attributes('confirm', tr('auth:confirmPassword'))}
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
                  <Trans
                    i18nKey="auth:iHaveReadPrivacyDataIUnderstandThatEmail"
                    components={{ slot0: <Link to="/privacy" /> }}
                  />
                </span>
              </label>
              {feedback('privacy')}
            </div>
          )}
          {attempted && Object.keys(issues).length > 0 && (
            <div className="notice error" role="alert">
              <Trans
                i18nKey="auth:checkTheHighlightedFields"
                components={{ slot0: <MessageValue value={localize(Object.values(issues)[0])} /> }}
              />
            </div>
          )}
          <div ref={errorRef} tabIndex={-1}>
            <ErrorBox message={error || null} />
          </div>
          <button className="button primary" disabled={busy}>
            {busy
              ? tr('auth:pleaseWait')
              : mode === 'register'
                ? tr('auth:createAccount')
                : mode === 'recover'
                  ? tr('auth:resetPassword')
                  : mode === 'claim'
                    ? tr('auth:createPasswordKeepMyJournal')
                    : tr('auth:signIn')}
          </button>
        </fieldset>
      </form>
      <div className="auth-links">
        <Link to="/sign-in">{tr('auth:signIn')}</Link>
        <Link to="/register">{tr('auth:createAnAccount')}</Link>
        <Link to="/recover">{tr('auth:recoverAccount')}</Link>
      </div>
      {mode === 'register' && (
        <p className="small muted">
          {tr('auth:pilotAccessIsFreeCloudflareStorageAndTrafficQuotas')}
        </p>
      )}
    </section>
  );
}
