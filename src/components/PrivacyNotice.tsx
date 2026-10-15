import { useTranslation } from 'react-i18next';
import { t as tr } from '../i18n';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { NOTICE_KEY, readLocal, writeLocal } from '../lib/appearance';

export function PrivacyNotice() {
  useTranslation();
  const [visible, setVisible] = useState(() => readLocal(NOTICE_KEY) !== '1');
  if (!visible) return null;
  return (
    <aside className="privacy-notice" aria-label={tr('privacyNotice:cookiesAndDataNotice')}>
      <ShieldCheck size={22} />
      <div>
        <strong>{tr('privacyNotice:cookiesYourData')}</strong>
        <p>{tr('privacyNotice:weUseNecessarySignInCookiesSavedJournalsAre')}</p>
        <Link to="/privacy">{tr('privacyNotice:readAboutPrivacyData')}</Link>
      </div>
      <button
        className="button secondary small-button"
        onClick={() => {
          writeLocal(NOTICE_KEY, '1');
          setVisible(false);
        }}
      >
        {tr('privacyNotice:gotIt')}
      </button>
    </aside>
  );
}
