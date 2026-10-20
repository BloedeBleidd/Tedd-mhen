import { useTranslation } from 'react-i18next';
import { locale, t as tr } from '../i18n';
import { PendingAccountGuard } from '../components/PendingAccountGuard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useLoad } from '../lib/api';
import { ErrorBox, Field, PageHeading, Panel } from '../components/ui';
import { loginPassword, passwordSchema } from '../../shared/credentials';
import type { AccountUsage } from '../../shared/assistant';
import { RecoverySecret } from './Auth';

export function Account() {
  useTranslation();
  const { request, invalidate, demo } = useApi();
  const pending = useRef(false);
  const session = useLoad<{ email: string; local: boolean }>('/api/session');
  const usage = useLoad<AccountUsage>('/api/account/usage');
  const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const unavailable = demo || session.data?.local || !session.data;
  useEffect(() => {
    const onUsageUpdated = () => usage.retry();
    window.addEventListener('teddmhen:usage-updated', onUsageUpdated);
    return () => window.removeEventListener('teddmhen:usage-updated', onUsageUpdated);
  });
  const fmtInt = (value: number) => value.toLocaleString(locale());
  const fmtMb = (bytes: number, nonZeroFloor = false) => {
    const rawMb = bytes / (1024 * 1024);
    const value = nonZeroFloor && bytes > 0 ? Math.max(0.01, rawMb) : rawMb;
    return value.toLocaleString(locale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
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
  const aiPercent = usage.data
    ? Math.min(100, (usage.data.ai.usedTokensToday / usage.data.ai.dailyTokenLimit) * 100)
    : 0;
  const storagePercent = usage.data
    ? Math.min(100, (usage.data.storage.usedBytes / usage.data.storage.limitBytes) * 100)
    : 0;
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
      <Panel title={tr('account:usageAndLimits')} className="prose-panel">
        <p>{tr('account:usageAndLimitsLead')}</p>
        {usage.data ? (
          <>
            <div className="account-usage-grid">
              <section className="usage-card" aria-labelledby="usage-ai-heading">
                <h3 id="usage-ai-heading">{tr('account:dailyAiTokens')}</h3>
                <strong className="usage-primary">
                  {tr('account:tokensUsedToday', {
                    used: fmtInt(usage.data.ai.usedTokensToday),
                    limit: fmtInt(usage.data.ai.dailyTokenLimit),
                  })}
                </strong>
                <div className="usage-meter" aria-hidden="true">
                  <span style={{ width: `${aiPercent}%` }} />
                </div>
                <p className="small muted">
                  {tr('account:tokensRemainingToday', {
                    remaining: fmtInt(usage.data.ai.remainingTokensToday),
                    requests: fmtInt(usage.data.ai.requestsToday),
                  })}
                </p>
                <p className="small muted">
                  {tr('account:tokenLimitsPerPrompt', {
                    input: fmtInt(usage.data.ai.maxInputTokens),
                    output: fmtInt(usage.data.ai.maxOutputTokens),
                  })}
                </p>
              </section>
              <section className="usage-card" aria-labelledby="usage-storage-heading">
                <h3 id="usage-storage-heading">{tr('account:accountStorage')}</h3>
                <strong className="usage-primary">
                  {tr('account:storageUsedOverall', {
                    usedMb: fmtMb(usage.data.storage.usedBytes, true),
                    limitMb: fmtMb(usage.data.storage.limitBytes),
                  })}
                </strong>
                <div className="usage-meter" aria-hidden="true">
                  <span style={{ width: `${storagePercent}%` }} />
                </div>
                <p className="small muted">
                  {tr('account:storageRemaining', {
                    remainingMb: fmtMb(usage.data.storage.remainingBytes),
                  })}
                </p>
                <p className="small muted">
                  {tr('account:savedDaysCount', {
                    days: fmtInt(usage.data.storage.entryCount),
                    habits: fmtInt(usage.data.storage.habitCount),
                  })}
                </p>
              </section>
            </div>
            <div className="account-usage-actions">
              <button type="button" className="button secondary small-button" onClick={usage.retry}>
                {tr('account:refreshUsage')}
              </button>
              <button
                type="button"
                className="button secondary small-button"
                onClick={() => window.dispatchEvent(new CustomEvent('teddmhen:open-assistant'))}
              >
                {tr('account:openAiGuide')}
              </button>
            </div>
          </>
        ) : (
          <p className="small muted">{tr('account:loadingUsage')}</p>
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
