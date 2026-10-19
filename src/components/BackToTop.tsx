import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react';
import { t } from '../i18n';
import { useReducedMotion } from '../lib/motion';

/** Scroll offset (px) after which the button appears. */
export const BACK_TO_TOP_OFFSET = 480;

/** Fixed bottom-right control that returns to the top of the page and moves focus to the content. */
export function BackToTop() {
  useTranslation();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > BACK_TO_TOP_OFFSET);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="back-to-top"
      aria-label={t('app:backToTop')}
      title={t('app:backToTop')}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
