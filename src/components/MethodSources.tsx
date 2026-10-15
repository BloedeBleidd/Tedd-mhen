import { useTranslation } from 'react-i18next';
import { references } from '../../shared/features';
import { localize, t } from '../i18n';
import { WorkspaceLink } from './WorkspaceLink';

export function MethodSources({ ids }: { ids: (keyof typeof references)[] }) {
  useTranslation();
  return (
    <aside className="method-sources" aria-label={t('analysisTools:sources')}>
      <strong>{t('analysisTools:sources')}</strong>
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <a href={references[id].url} target="_blank" rel="noreferrer" className="text-link">
              {localize(references[id].title)}
            </a>
          </li>
        ))}
      </ul>
      <p>{t('analysisTools:evidenceScope')}</p>
      <WorkspaceLink className="text-link" to="/analysis/metrics">
        {t('analysisTools:readMethods')}
      </WorkspaceLink>
    </aside>
  );
}
