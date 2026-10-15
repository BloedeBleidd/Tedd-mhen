import { useTranslation } from 'react-i18next';
import { t as tr } from '../i18n';
import { PendingAccountGuard } from '../components/PendingAccountGuard';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useLoad } from '../lib/api';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
import { loginPassword, passwordSchema } from '../../shared/credentials';
import { RecoverySecret } from './Auth';

export function Account() {
  useTranslation();
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
      showError(cause instanceof Error ? cause.message : 'account:unableToCompleteThisRequest');
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
      showError(
        JSON.stringify(
          current.error.issues.map((issue) => ({ ...issue, path: ['currentPassword'] })),
        ),
      );
      return;
    }
    if (!next.success) {
      showError(
        JSON.stringify(next.error.issues.map((issue) => ({ ...issue, path: ['password'] }))),
      );
      return;
    }
    if (password !== confirm) {
      showError('account:passwordsDoNotMatch');
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
        eyebrow={tr('account:accountAccess')}
        title={tr('account:yourAccount')}
        description={tr('account:manageYourPasswordRecoveryAndSavedJournal')}
      />
      <div ref={errorRef} tabIndex={-1}>
        <ErrorBox message={error || session.error} />
      </div>
      <Panel title={session.data?.email || tr('app:account2')} className="prose-panel">
        <p>{tr('account:emailIsAnUnverifiedSignInIdentifierWeDo')}</p>
        {unavailable ? (
          <>
            <p>
              {demo
                ? tr('account:createAnAccountToSaveYourOwnJournalDemo')
                : session.data?.local
                  ? tr('account:accountChangesAreUnavailableInTheLocalDevelopmentBypass')
                  : tr('account:accountDetailsAreUnavailableReloadOrSignInAgain')}
            </p>
            {demo && (
              <Link className="button primary" to="/register">
                {tr('account:createAccount')}
              </Link>
            )}
          </>
        ) : (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void action('logout')}
          >
            {tr('account:signOut')}
          </button>
        )}
      </Panel>
      {!unavailable && (
        <Panel title={tr('account:passwordRecovery')} className="prose-panel">
          <form noValidate className="auth-form" onSubmit={change}>
            <fieldset className="form-fieldset auth-form" disabled={busy}>
              <Field label={tr('account:currentPassword')}>
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
                label={tr('account:newPassword')}
                hint={tr('account:12128CharactersChangingItAlsoReplacesYourRecovery')}
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
              <Field label={tr('account:confirmNewPassword')}>
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
                {tr('account:changePasswordRecoveryCode')}
              </button>
            </fieldset>
          </form>
          <div className="account-delete">
            <h3>{tr('account:deleteAccountAndJournal')}</h3>
            <p>{tr('account:exportAnythingYouWantToKeepFirstThisDeletes')}</p>
            <button
              className="button danger"
              disabled={busy || !currentPassword}
              onClick={() => {
                if (
                  window.confirm(tr('account:permanentlyDeleteYourAccountAndEveryJournalEntryThis'))
                )
                  void action('delete-account');
              }}
            >
              {tr('account:deleteAccountAndAllEntries')}
            </button>
            <p className="small muted">
              {tr('account:enterYourCurrentPasswordAboveToEnableDeletion')}
            </p>
          </div>
        </Panel>
      )}
    </>
  );
}
