import { useTranslation } from 'react-i18next';
import { t as tr } from '../i18n';
import { PageHeading, Panel } from '../components/ui';
export function About() {
  useTranslation();
  return (
    <>
      <PageHeading
        eyebrow={tr('about:aboutTheAuthor')}
        title={tr('about:piotrMuda')}
        description={tr('about:electronicsSoftwareSportAndACuriosityAboutHowWe')}
      />
      <Panel title={tr('about:aProjectBuiltFromLongStandingInterests')} className="prose-panel">
        <p>{tr('about:iMPiotrMudaALongTimeEnthusiastOf')}</p>
        <p>{tr('about:myInterestsAlsoIncludeLongevityQualityOfLifeBiology')}</p>
        <p>{tr('about:iWantTheProjectToMakePersonalDataUnderstandable')}</p>
        <a className="text-link" href="https://piotrzmudadev.com" target="_blank" rel="noreferrer">
          {tr('about:visitPiotrzmudadevCom')}
        </a>
      </Panel>
    </>
  );
}
