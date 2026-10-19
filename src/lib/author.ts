import type { Language } from '../i18n';
import type { SunLocation } from './appearance';
import type { LanguageMode } from './language-context';
import { locateLanguage } from './language-location';

export const authorUrl = (language: Language) =>
  `https://piotrzmudadev.com/${language === 'pl' ? 'o-mnie/' : 'en/about/'}`;

/** Resolve saved preferences before redirecting, including cold loads in automatic mode. */
export async function resolveAuthorUrl(mode: LanguageMode, location: SunLocation | null) {
  if (mode !== 'auto') return authorUrl(mode);
  if (location) {
    try {
      const { language } = await locateLanguage(location.latitude, location.longitude);
      return authorUrl(language);
    } catch {
      // Match automatic language selection's English fallback.
    }
  }
  return authorUrl('en');
}
