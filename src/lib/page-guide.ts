/** Browser-only record of page guides the user has collapsed. Contains no journal data. */
export const GUIDE_KEY = 'teddmhen.guides.v1';

export const guideIds = ['overview', 'checkIn', 'journal', 'analysis', 'data'] as const;
export type GuideId = (typeof guideIds)[number];

/** Number of numbered tips authored in the `guide` namespace for each page. */
export const guideTipCount: Record<GuideId, number> = {
  overview: 3,
  checkIn: 5,
  journal: 3,
  analysis: 4,
  data: 4,
};

/** Map a workspace path (without the `/demo` prefix) to its guide, if the page has one. */
export function guideFor(pathname: string): GuideId | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'overview';
  if (path === '/check-in') return 'checkIn';
  if (path === '/journal') return 'journal';
  if (path === '/analysis' || path.startsWith('/analysis/')) return 'analysis';
  if (path === '/export' || path === '/import') return 'data';
  return null;
}

/** Unknown, duplicated or malformed stored values are discarded rather than trusted. */
export function parseHiddenGuides(raw: string | null): GuideId[] {
  try {
    const value: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(value)) return [];
    return guideIds.filter((id) => value.includes(id));
  } catch {
    return [];
  }
}

export function setGuideHidden(hidden: readonly GuideId[], id: GuideId, hide: boolean): GuideId[] {
  const next = new Set(hidden);
  if (hide) next.add(id);
  else next.delete(id);
  return guideIds.filter((guide) => next.has(guide));
}
