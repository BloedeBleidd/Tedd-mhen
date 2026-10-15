import type { Language } from '../i18n';
export type Region = { country: string; language: Language; polygons: number[][][][] };

// Ray casting uses longitude/latitude in degrees. Holes exclude lakes and enclaves.
export function inRing(longitude: number, latitude: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function languageAt(
  latitude: number,
  longitude: number,
  regions: Region[],
): { language: Language; country: string | null } {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return { language: 'en', country: null };
  for (const region of regions) {
    if (
      region.polygons.some(
        ([outer, ...holes]) =>
          inRing(longitude, latitude, outer) &&
          !holes.some((hole) => inRing(longitude, latitude, hole)),
      )
    )
      return { language: region.language, country: region.country };
  }
  return { language: 'en', country: null };
}
export async function locateLanguage(latitude: number, longitude: number) {
  const { default: regions } = await import('../data/language-regions.json');
  return languageAt(latitude, longitude, regions as Region[]);
}
