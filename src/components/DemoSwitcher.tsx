import { FlaskConical, LockKeyhole, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useApi } from '../lib/api';

export function DemoSwitcher() {
  const root = useRef<HTMLElement>(null);
  const { demo, demoLoading, demoError, demoRecordCount, toggleDemo, cancelDemoLoad } = useApi();
  useLayoutEffect(() => {
    const element = root.current;
    const shell = element?.closest<HTMLElement>('.main-shell');
    if (!element || !shell) return;
    const measure = () => {
      const bottom = Number.parseFloat(getComputedStyle(element).bottom) || 0;
      shell.style.setProperty(
        '--workspace-clearance',
        `${Math.ceil(element.getBoundingClientRect().height + bottom + 16)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--workspace-clearance');
    };
  }, []);
  return (
    <section
      ref={root}
      className={`workspace-switcher ${demo ? 'is-demo' : ''}`}
      aria-label="Data workspace"
    >
      {demoError && (
        <p className="workspace-error" role="alert">
          {demoError}
        </p>
      )}
      <div className="workspace-dock">
        <span className="workspace-spark" key={String(demo)} aria-hidden="true">
          <Sparkles size={23} />
        </span>
        <div className="workspace-copy" aria-live="polite">
          <strong>
            {demo ? 'Demo workspace · make yourself at home' : 'See what your data could reveal'}
          </strong>
          <span>
            {demoLoading
              ? 'Loading the example journal… You can keep using your data.'
              : demo
                ? `${demoRecordCount} example days. Try edits and imports; they reset when you leave.`
                : 'Explore months of training, sleep and recovery. Your journal stays yours.'}
          </span>
        </div>
        <div className="workspace-options" role="group" aria-label="Choose data source">
          <button
            aria-label="Use my data"
            aria-pressed={!demo}
            onClick={() => {
              if (demo) toggleDemo();
              else cancelDemoLoad();
            }}
          >
            <LockKeyhole size={16} /> My data
          </button>
          <button
            aria-label="Explore a demo"
            aria-pressed={demo}
            disabled={demoLoading}
            onClick={() => {
              if (!demo) toggleDemo();
            }}
          >
            <FlaskConical className="workspace-flask" key={String(demo)} size={17} />{' '}
            {demoLoading ? 'Loading…' : 'Demo data'}
          </button>
        </div>
      </div>
    </section>
  );
}
