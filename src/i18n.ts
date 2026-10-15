import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import english from './locales/en';
const resources = { en: english };
export const languages = ['en', 'pl', 'es', 'de', 'fr', 'pt'] as const;
export type Language = (typeof languages)[number];
export const languageNames: Record<Language, string> = {
  en: 'English',
  pl: 'Polski',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  pt: 'Português',
};
export const locale = () =>
  ({ en: 'en-GB', pl: 'pl-PL', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pt: 'pt-PT' })[
    i18next.language as Language
  ] || 'en-GB';
void i18next.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...languages],
  defaultNS: 'app',
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
export const t = (key: string, values?: Record<string, unknown>): string =>
  i18next.t(key, values || {}) as string;
export default i18next;

// Only application-owned metadata and error messages use this adapter. Never pass journal text.
const sourceKeys = new Map(
  Object.entries(resources.en).flatMap(([ns, messages]) =>
    Object.entries(messages)
      .filter(([, value]) => !value.includes('<slot'))
      .map(([key, value]) => [value, `${ns}:${key}`] as const),
  ),
);
export const hasSourceMessage = (message: string) => sourceKeys.has(message);
const templates = [...sourceKeys]
  .filter(([value]) => value.includes('{{'))
  .map(([source, key]) => {
    const names: string[] = [];
    const pattern = source
      .split(/(\{\{\w+\}\})/g)
      .map((part) => {
        const match = part.match(/^\{\{(\w+)\}\}$/);
        if (match) {
          names.push(match[1]);
          return '([\\s\\S]*?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { key, names, regex: new RegExp('^' + pattern + '$') };
  });
export function localize(message: string | null | undefined): string {
  if (!message) return message || '';
  if (message.startsWith('Habit: ')) {
    try {
      const value = JSON.parse(message.slice(7));
      const name = value.key.startsWith('preset:')
        ? t('habitCatalog:' + value.key.slice(7))
        : value.name;
      return t('habits:feature_' + value.measure, { name });
    } catch {
      return message;
    }
  }
  const key = sourceKeys.get(message);
  if (key) return t(key);
  for (const [prefix, namespace, template] of [
    ['Activity: ', 'activities', 'activity'],
    ['Symptom: ', 'enums', 'symptom'],
    ['Source: ', 'enums', 'source'],
    ['HRV method: ', 'enums', 'hrvMethod'],
  ])
    if (message.startsWith(prefix))
      return t('measurements:' + template, {
        value0: t(namespace + ':' + message.slice(prefix.length).replaceAll(' ', '_')),
      });
  if (message.startsWith('Context: '))
    return t('measurements:context', { value0: message.slice(9) });
  if (['count', 'points', 'cyclic', 'numeric', 'binary'].includes(message))
    return enumLabel(message);
  for (const template of templates) {
    const match = message.match(template.regex);
    if (match)
      return t(
        template.key,
        Object.fromEntries(template.names.map((name, i) => [name, match[i + 1]])),
      );
  }
  return message;
}
export const enumLabel = (value: string) => t(`enums:${value}`);

const languageLoaders = {
  pl: () => import('./locales/pl'),
  es: () => import('./locales/es'),
  de: () => import('./locales/de'),
  fr: () => import('./locales/fr'),
  pt: () => import('./locales/pt'),
};
const loadedLanguages = new Set<Language>(['en']);
export async function loadLanguage(language: Language) {
  if (loadedLanguages.has(language)) return;
  const { default: namespaces } = await languageLoaders[language as Exclude<Language, 'en'>]();
  for (const [namespace, messages] of Object.entries(namespaces))
    i18next.addResourceBundle(language, namespace, messages, true, true);
  loadedLanguages.add(language);
}
