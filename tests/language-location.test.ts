import { describe, expect, it } from 'vitest';
import { inRing, languageAt, type Region } from '../src/lib/language-location';
import regions from '../src/data/language-regions.json';

describe('Offline location language', () => {
  it.each([
    [52.23, 21.01, 'pl'],
    [52.52, 13.4, 'de'],
    [48.86, 2.35, 'fr'],
    [40.42, -3.7, 'es'],
    [38.72, -9.14, 'pt'],
    [-23.55, -46.63, 'pt'],
    [19.43, -99.13, 'es'],
    [14.69, -17.44, 'fr'],
    [0, 0, 'en'],
    [35.68, 139.69, 'en'],
    [NaN, 0, 'en'],
    [91, 0, 'en'],
    [0, 181, 'en'],
  ])('resolves %s, %s to %s without network lookup', (latitude, longitude, expected) => {
    expect(languageAt(latitude, longitude, regions as Region[]).language).toBe(expected);
  });
  it('respects holes and disconnected polygons, without guessing a nearby country at sea', () => {
    const outer = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const hole = [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
      [2, 2],
    ];
    expect(inRing(1, 1, outer)).toBe(true);
    expect(inRing(11, 1, outer)).toBe(false);
    const map: Region[] = [
      {
        country: 'PL',
        language: 'pl',
        polygons: [
          [outer, hole],
          [
            [
              [20, 20],
              [21, 20],
              [21, 21],
              [20, 21],
              [20, 20],
            ],
          ],
        ],
      },
    ];
    expect(languageAt(3, 3, map).language).toBe('en');
    expect(languageAt(1, 1, map).language).toBe('pl');
    expect(languageAt(20.5, 20.5, map).language).toBe('pl');
  });
});
