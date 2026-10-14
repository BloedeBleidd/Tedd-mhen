import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeReveal } from '../src/lib/motion';

let intersect: (entries: { isIntersecting: boolean }[]) => void;
let changed: () => void;
const intersectionDisconnect = vi.fn(),
  mutationDisconnect = vi.fn();
function target(points = false) {
  return {
    classList: { contains: (name: string) => points && name === 'chart-points' },
    animate: vi.fn(() => ({ cancel: vi.fn(), id: '' })),
  };
}
function root(layers: ReturnType<typeof target>[] = []) {
  const listeners = new Map<string, () => void>();
  return {
    ...target(),
    querySelectorAll: vi.fn(() => layers),
    addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    listeners,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('document', { visibilityState: 'visible' });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe = vi.fn();
      disconnect = intersectionDisconnect;
    },
  );
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: typeof changed) {
        changed = callback;
      }
      observe = vi.fn();
      disconnect = mutationDisconnect;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe('Motion lifecycle', () => {
  it('waits for visible, rendered SVG layers and reveals their final geometry only once', () => {
    const line = target(),
      points = target(true),
      element = root();
    const dispose = observeReveal(element as unknown as HTMLElement, 'chart');
    intersect([{ isIntersecting: false }]);
    expect(line.animate).not.toHaveBeenCalled();
    intersect([{ isIntersecting: true }]);
    expect(mutationDisconnect).not.toHaveBeenCalled();
    element.querySelectorAll.mockReturnValue([line, points]);
    changed();
    expect(line.animate).toHaveBeenCalledWith(
      [
        { opacity: 0.35, clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, clipPath: 'inset(0 0% 0 0)' },
      ],
      expect.objectContaining({ duration: 640, fill: 'none' }),
    );
    expect(points.animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 360, fill: 'none' }),
    );
    changed();
    intersect([{ isIntersecting: true }]);
    expect(line.animate).toHaveBeenCalledTimes(1);
    expect(intersectionDisconnect).toHaveBeenCalled();
    expect(mutationDisconnect).toHaveBeenCalled();
    dispose();
    expect(line.animate.mock.results[0].value.cancel).toHaveBeenCalled();
    expect(element.listeners.size).toBe(0);
  });
  it('settles immediately on focus and prevents late callbacks from restarting a disposed reveal', () => {
    const element = root();
    const dispose = observeReveal(element as unknown as HTMLElement, 'panel');
    intersect([{ isIntersecting: true }]);
    element.listeners.get('focusin')!();
    expect(element.animate.mock.results[0].value.cancel).toHaveBeenCalled();
    dispose();
    intersect([{ isIntersecting: true }]);
    expect(element.animate).toHaveBeenCalledTimes(1);
    const pending = root();
    const cancel = observeReveal(pending as unknown as HTMLElement, 'panel');
    cancel();
    intersect([{ isIntersecting: true }]);
    expect(pending.animate).not.toHaveBeenCalled();
  });
  it('keeps content immediately available when reduced motion or animation support prevents enhancement', () => {
    const element = root();
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    observeReveal(element as unknown as HTMLElement, 'panel')();
    expect(element.addEventListener).not.toHaveBeenCalled();
    expect(element.animate).not.toHaveBeenCalled();
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const unsupported = { ...element, animate: undefined };
    expect(() => observeReveal(unsupported as unknown as HTMLElement, 'chart')()).not.toThrow();
    vi.stubGlobal('IntersectionObserver', undefined);
    observeReveal(element as unknown as HTMLElement, 'panel')();
    expect(element.animate).toHaveBeenCalledTimes(1);
  });
  it('does not animate a background document or continue a reveal into printing', () => {
    const element = root();
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    observeReveal(element as unknown as HTMLElement, 'panel');
    intersect([{ isIntersecting: true }]);
    expect(element.animate).not.toHaveBeenCalled();
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const dispose = observeReveal(element as unknown as HTMLElement, 'panel');
    intersect([{ isIntersecting: true }]);
    const beforePrint = vi.mocked(window.addEventListener).mock.calls.at(-1)![1] as () => void;
    beforePrint();
    expect(element.animate.mock.results[0].value.cancel).toHaveBeenCalled();
    dispose();
  });
});
