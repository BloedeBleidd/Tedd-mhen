import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, X } from 'lucide-react';
import { t } from '../i18n';
import { readLocal, writeLocal } from '../lib/appearance';
import {
  GUIDE_KEY,
  guideFor,
  guideTipCount,
  parseHiddenGuides,
  setGuideHidden,
} from '../lib/page-guide';

/** Short, page-specific explanation of remembered choices and workflows, shown above the page. */
export function PageGuide({ pathname, demo }: { pathname: string; demo: boolean }) {
  useTranslation();
  const [hidden, setHidden] = useState(() => parseHiddenGuides(readLocal(GUIDE_KEY)));
  const id = guideFor(pathname);
  if (!id) return null;
  const change = (hide: boolean) => {
    const next = setGuideHidden(hidden, id, hide);
    setHidden(next);
    writeLocal(GUIDE_KEY, JSON.stringify(next));
  };
  if (hidden.includes(id))
    return (
      <div className="page-guide-toggle">
        <button
          type="button"
          className="button secondary small-button"
          aria-expanded={false}
          onClick={() => change(false)}
        >
          <Lightbulb size={15} aria-hidden="true" />
          {t('guide:show')}
        </button>
      </div>
    );
  const tips = Array.from({ length: guideTipCount[id] }, (_, i) => t(`guide:${id}_${i + 1}`));
  return (
    <aside id="page-guide" className="page-guide" aria-labelledby="page-guide-title">
      <Lightbulb className="page-guide-icon" size={20} aria-hidden="true" />
      <div>
        <p className="eyebrow">{t('guide:eyebrow')}</p>
        <h2 id="page-guide-title">{t(`guide:${id}_title`)}</h2>
        <ol>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
        {demo && <p className="small muted">{t('guide:demoNote')}</p>}
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label={t('guide:hide')}
        aria-expanded={true}
        aria-controls="page-guide"
        onClick={() => change(true)}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
