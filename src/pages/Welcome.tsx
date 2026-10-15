import { useTranslation, Trans } from 'react-i18next';
import { t as tr } from '../i18n';
import { ArrowUpRight, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Welcome() {
  useTranslation();
  return (
    <section className="welcome-card auth-card">
      <p className="eyebrow">{tr('welcome:trainingSleepRecovery')}</p>
      <h1>
        <Trans i18nKey="welcome:yourDaysAClearerPicture" components={{ slot0: <br /> }} />
      </h1>
      <p>{tr('welcome:connectHowYouTrainSleepAndFeelExploreYour')}</p>
      <Link className="button primary demo-entry" to="/demo">
        <Trans
          i18nKey="welcome:tryDemo"
          components={{ slot0: <FlaskConical size={19} />, slot1: <ArrowUpRight size={18} /> }}
        />
      </Link>
      <p className="demo-entry-hint">
        {tr('welcome:noAccountNeededExploreACompleteExampleJournal')}
      </p>
      <div className="welcome-features">
        <span>{tr('welcome:dailyCheckInsTraining')}</span>
        <span>{tr('welcome:relationshipsPredictions')}</span>
        <span>{tr('welcome:importExport')}</span>
      </div>
      <nav className="welcome-actions" aria-label={tr('welcome:accountAccess')}>
        <Link className="button secondary" to="/register">
          {tr('welcome:createAccount')}
        </Link>
        <Link className="button secondary" to="/sign-in">
          {tr('welcome:signIn')}
        </Link>
      </nav>
    </section>
  );
}
