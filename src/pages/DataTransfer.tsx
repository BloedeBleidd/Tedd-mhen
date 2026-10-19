import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Download, Upload } from 'lucide-react';
import { t as tr } from '../i18n';
import { WorkspaceNavLink as NavLink } from '../components/WorkspaceLink';
import { Export } from './Export';
import { Import } from './Import';

const views = [
  { id: 'export', to: '/export', icon: Download },
  { id: 'import', to: '/import', icon: Upload },
] as const;

/** One destination for moving data out of and into the journal; each option keeps its own URL. */
export function DataTransfer({ mode }: { mode: 'export' | 'import' }) {
  useTranslation();
  return (
    <>
      <nav
        className="analysis-navigation transfer-navigation"
        aria-label={tr('dataTransfer:views')}
      >
        <p className="analysis-nav-label">{tr('dataTransfer:chooseAnOption')}</p>
        <div className="analysis-tabs transfer-tabs">
          {views.map(({ id, to, icon: Icon }) => (
            <NavLink
              key={id}
              to={to}
              aria-labelledby={`transfer-${id}-title`}
              aria-describedby={`transfer-${id}-description`}
            >
              {({ isActive }) => (
                <>
                  <Icon className="analysis-nav-icon" size={20} aria-hidden="true" />
                  <span className="analysis-nav-title" id={`transfer-${id}-title`}>
                    {tr(`dataTransfer:${id}Title`)}
                  </span>
                  {isActive ? (
                    <Check className="analysis-nav-indicator" size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight className="analysis-nav-indicator" size={16} aria-hidden="true" />
                  )}
                  <span className="analysis-nav-description" id={`transfer-${id}-description`}>
                    {tr(`dataTransfer:${id}Description`)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      {mode === 'export' ? <Export /> : <Import />}
    </>
  );
}
