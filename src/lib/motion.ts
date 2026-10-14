import { useEffect, useRef, useSyncExternalStore } from 'react';

const preference = '(prefers-reduced-motion: reduce)';
const reducedMotion = () =>
  typeof window === 'undefined' || !window.matchMedia || window.matchMedia(preference).matches;
const subscribe = (changed: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(preference);
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
};
export const useReducedMotion = () => useSyncExternalStore(subscribe, reducedMotion, () => true);

type RevealKind = 'panel' | 'chart';
const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Reveal final geometry once in view; cancellation always restores the ordinary visible styles. */
export function observeReveal(element: HTMLElement, kind: RevealKind) {
  if (reducedMotion() || typeof element.animate !== 'function') return () => {};
  let visible = typeof IntersectionObserver !== 'function',
    started = false;
  let intersection: IntersectionObserver | undefined, mutation: MutationObserver | undefined;
  const animations: Animation[] = [];
  const disconnect = () => {
    intersection?.disconnect();
    mutation?.disconnect();
  };
  const settle = () => {
    started = true;
    disconnect();
    animations.forEach((animation) => animation.cancel());
  };
  const reveal = () => {
    if (!visible || started) return;
    const targets =
      kind === 'chart' ? [...element.querySelectorAll<SVGElement>('.chart-series')] : [element];
    if (!targets.length) return;
    started = true;
    disconnect();
    if (reducedMotion() || document.visibilityState === 'hidden') return;
    for (const target of targets) {
      const trace = kind === 'chart' && !target.classList.contains('chart-points');
      const frames: Keyframe[] = trace
        ? [
            { opacity: 0.35, clipPath: 'inset(0 100% 0 0)' },
            { opacity: 1, clipPath: 'inset(0 0% 0 0)' },
          ]
        : [{ opacity: 0 }, { opacity: 1 }];
      const animation = target.animate(frames, {
        duration: trace ? 640 : 360,
        easing,
        fill: 'none',
      });
      animation.id = `teddmhen-${kind}`;
      animations.push(animation);
    }
  };
  if (typeof IntersectionObserver === 'function') {
    intersection = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        reveal();
      },
      { threshold: 0 },
    );
    intersection.observe(element);
  }
  // Responsive charts create their SVG layers after the container receives its first size.
  if (kind === 'chart' && typeof MutationObserver === 'function') {
    mutation = new MutationObserver(reveal);
    mutation.observe(element, { childList: true, subtree: true });
  }
  element.addEventListener('focusin', settle);
  window.addEventListener('beforeprint', settle);
  reveal();
  return () => {
    settle();
    element.removeEventListener('focusin', settle);
    window.removeEventListener('beforeprint', settle);
  };
}

export function useReveal<T extends HTMLElement>(kind: RevealKind = 'panel', revision = '') {
  const ref = useRef<T>(null),
    reduced = useReducedMotion();
  useEffect(() => {
    if (!ref.current || reduced) return;
    return observeReveal(ref.current, kind);
  }, [kind, revision, reduced]);
  return ref;
}
