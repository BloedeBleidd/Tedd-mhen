import { getTimes } from 'suncalc';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';
export type SunLocation = { latitude: number; longitude: number; capturedAt: string };
export type Appearance = { mode: ThemeMode; location: SunLocation | null };
export const APPEARANCE_KEY = 'teddmhen.appearance.v1';
export const NOTICE_KEY = 'teddmhen.privacy-notice.v1';
export const defaultAppearance: Appearance = { mode: 'auto', location: null };

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export function parseAppearance(raw: string | null): Appearance {
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || !['auto', 'light', 'dark'].includes(value.mode)) return defaultAppearance;
    const point = value.location;
    const location =
      point &&
      Number.isFinite(point.latitude) &&
      Math.abs(point.latitude) <= 90 &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.longitude) <= 180 &&
      typeof point.capturedAt === 'string' &&
      Number.isFinite(Date.parse(point.capturedAt))
        ? { latitude: point.latitude, longitude: point.longitude, capturedAt: point.capturedAt }
        : null;
    return { mode: value.mode, location };
  } catch {
    return defaultAppearance;
  }
}

export function solarTheme(now: Date, location: SunLocation) {
  const times = getTimes(now, location.latitude, location.longitude);
  const theme: Theme =
    times.alwaysUp || (times.sunrise && times.sunset && now >= times.sunrise && now < times.sunset)
      ? 'light'
      : 'dark';
  // Absolute instants avoid device time-zone and daylight-saving arithmetic errors.
  const events = [-1, 0, 1, 2]
    .flatMap((offset) => {
      const day = getTimes(
        new Date(now.getTime() + offset * 86400000),
        location.latitude,
        location.longitude,
      );
      return [
        ...(day.sunrise ? [{ at: day.sunrise, theme: 'light' as const }] : []),
        ...(day.sunset ? [{ at: day.sunset, theme: 'dark' as const }] : []),
      ];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return {
    theme,
    next: events.find((event) => event.at > now) ?? null,
    polar: times.alwaysUp ? ('day' as const) : times.alwaysDown ? ('night' as const) : null,
  };
}
export function resolveAppearance(settings: Appearance, now: Date, _systemDark?: boolean) {
  if (settings.mode !== 'auto')
    return { theme: settings.mode, source: 'manual' as const, next: null, polar: null };
  if (!settings.location)
    return {
      theme: 'light' as const,
      source: 'fallback' as const,
      next: null,
      polar: null,
    };
  return { ...solarTheme(now, settings.location), source: 'sun' as const };
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#14201b' : '#f7f8f3');
}
