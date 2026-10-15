import { useTranslation } from 'react-i18next';
import { t } from '../i18n';

export function PageError() {
  useTranslation();
  return (
    <main className="public-shell">
      <section className="auth-card panel" role="alert">
        <h1>{t('app:pageFailed')}</h1>
        <p>{t('app:pageFailedDetail')}</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          {t('app:reload')}
        </button>
      </section>
    </main>
  );
}
