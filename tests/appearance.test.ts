import { describe, expect, it } from 'vitest';
import { getTimes } from 'suncalc';
import { parseAppearance, resolveAppearance, solarTheme } from '../src/lib/appearance';
const warsaw = { latitude: 52.23, longitude: 21.01, capturedAt: '2026-10-14T12:00:00Z' };
describe('Solar appearance', () => {
  it('switches at sunrise and sunset and schedules the next morning', () => {
    const noon = new Date('2026-06-21T12:00:00Z');
    const { sunrise, sunset } = getTimes(noon, warsaw.latitude, warsaw.longitude);
    expect(solarTheme(new Date(sunrise!.getTime() - 1), warsaw).theme).toBe('dark');
    expect(solarTheme(sunrise!, warsaw).theme).toBe('light');
    expect(solarTheme(new Date(sunset!.getTime() - 1), warsaw).theme).toBe('light');
    const evening = solarTheme(sunset!, warsaw);
    expect(evening.theme).toBe('dark');
    expect(evening.next?.theme).toBe('light');
    expect(evening.next!.at.getTime()).toBeGreaterThan(sunset!.getTime());
  });
  it('handles polar day and night without invalid dates', () => {
    const north = { ...warsaw, latitude: 78.22, longitude: 15.65 };
    expect(solarTheme(new Date('2026-06-21T00:00:00Z'), north)).toMatchObject({
      theme: 'light',
      polar: 'day',
      next: null,
    });
    expect(solarTheme(new Date('2026-12-21T12:00:00Z'), north)).toMatchObject({
      theme: 'dark',
      polar: 'night',
      next: null,
    });
  });
  it('uses the solar day at remote longitudes, including near UTC midnight', () => {
    const auckland = { ...warsaw, latitude: -36.85, longitude: 174.76 };
    expect(solarTheme(new Date('2026-12-21T23:30:00Z'), auckland).theme).toBe('light');
    expect(solarTheme(new Date('2026-12-21T11:30:00Z'), auckland).theme).toBe('dark');
  });
  it('honours manual choices and uses light without a location', () => {
    const now = new Date('2026-06-21T12:00:00Z');
    expect(resolveAppearance({ mode: 'dark', location: warsaw }, now, false).theme).toBe('dark');
    expect(resolveAppearance({ mode: 'auto', location: null }, now, true)).toMatchObject({
      theme: 'light',
      source: 'fallback',
    });
  });
  it('rejects malformed local preferences and invalid coordinates', () => {
    for (const raw of ['{', 'null', '[]', '{"mode":"wrong"}'])
      expect(parseAppearance(raw)).toEqual({ mode: 'auto', location: null });
    expect(
      parseAppearance(JSON.stringify({ mode: 'dark', location: { ...warsaw, latitude: 91 } })),
    ).toEqual({ mode: 'dark', location: null });
    expect(parseAppearance(JSON.stringify({ mode: 'auto', location: warsaw }))).toEqual({
      mode: 'auto',
      location: warsaw,
    });
  });
});
