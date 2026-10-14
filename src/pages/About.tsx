import { PageHeading, Panel } from '../components/ui';
export function About() {
  return (
    <>
      <PageHeading
        eyebrow="ABOUT THE AUTHOR"
        title="Piotr Żmuda."
        description="Electronics, software, sport—and a curiosity about how we live."
      />
      <Panel title="A project built from long-standing interests" className="prose-panel">
        <p>
          I’m Piotr Żmuda, a long-time enthusiast of electronics, programming and systems. Sport is
          another lasting part of my life, spanning powerlifting and long-distance running.
        </p>
        <p>
          My interests also include longevity, quality of life, biology and chemistry. Tedd’mhen
          brings these interests together: a place to record training and everyday observations,
          then examine patterns with transparent mathematics.
        </p>
        <p>
          I want the project to make personal data understandable: what was measured, what is
          missing, how an estimate was calculated, and how uncertain it remains. The application’s
          references describe its methods; they do not turn personal correlations into medical
          conclusions.
        </p>
        <a className="text-link" href="https://piotrzmudadev.com" target="_blank" rel="noreferrer">
          Visit piotrzmudadev.com ↗
        </a>
      </Panel>
    </>
  );
}
