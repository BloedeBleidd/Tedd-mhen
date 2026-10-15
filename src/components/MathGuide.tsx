import { useTranslation } from 'react-i18next';
import { references } from '../../shared/features';
import { localize, t } from '../i18n';
import { Panel } from './ui';

const topics = ['association', 'bayes', 'uncertainty', 'validation', 'review'] as const;
const sources = {
  association: references.correlation,
  bayes: references.bayes,
  uncertainty: references.validation,
  validation: references.intervalScore,
  review: {
    title: 'NIST/SEMATECH: Detection of Outliers',
    url: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm',
  },
};
export function MathGuide() {
  useTranslation();
  return (
    <Panel id="mathematics" title={t('mathGuide:title')} subtitle={t('mathGuide:intro')}>
      {topics.map((topic) => (
        <details className="method-topic" key={topic}>
          <summary>{t(`mathGuide:${topic}Title`)}</summary>
          <p>{t(`mathGuide:${topic}Explanation`)}</p>
          <pre className="method-formula">{t(`mathGuide:${topic}Formula`)}</pre>
          <p>{t(`mathGuide:${topic}Symbols`)}</p>
          <p className="method-example">{t(`mathGuide:${topic}Example`)}</p>
          <a className="text-link" href={sources[topic].url} target="_blank" rel="noreferrer">
            {topic === 'review' ? t('mathGuide:reviewSource') : localize(sources[topic].title)}
          </a>
        </details>
      ))}
      <p className="small muted">{t('mathGuide:limits')}</p>
      <a
        className="text-link"
        href="https://github.com/BloedeBleidd/Tedd-mhen/blob/main/docs/METHODOLOGY.md"
        target="_blank"
        rel="noreferrer"
      >
        {t('mathGuide:specification')}
      </a>
    </Panel>
  );
}
