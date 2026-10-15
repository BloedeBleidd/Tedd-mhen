import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import i18n, { loadLanguage, languages, t, type Language } from '../i18n';
import { useAppearance } from './appearance-context';
import { readLocal, writeLocal } from './appearance';
import { locateLanguage } from './language-location';
export const LANGUAGE_KEY = 'teddmhen.language.v1';
export type LanguageMode = 'auto' | Language;
export function parseLanguage(value: string | null): LanguageMode {
  return value === 'auto' || languages.includes(value as Language)
    ? (value as LanguageMode)
    : 'auto';
}
const Context = createContext<{
  mode: LanguageMode;
  language: Language;
  country: string | null;
  persistent: boolean;
  loading: boolean;
  loadFailed: boolean;
  retry: () => void;
  choose: (mode: LanguageMode) => void;
}>(null!);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useAppearance();
  const updateRef = useRef(update);
  updateRef.current = update;
  const [mode, setMode] = useState(() => parseLanguage(readLocal(LANGUAGE_KEY)));
  const [automatic, setAutomatic] = useState<{ language: Language; country: string | null }>({
    language: 'en',
    country: null,
  });
  const [persistent, setPersistent] = useState(true);
  const requested = mode === 'auto' ? automatic.language : mode;
  const [language, setLanguage] = useState<Language>('en');
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useLayoutEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void loadLanguage(requested)
      .then(async () => {
        if (!active) return;
        await i18n.changeLanguage(requested);
        if (!active) return;
        setLanguage(requested);
        setLoading(false);
        document.documentElement.lang = requested;
        document.title = t('app:documentTitle');
        document
          .querySelector('meta[name="description"]')
          ?.setAttribute('content', t('app:documentDescription'));
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setLoadFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [requested, attempt]);
  useEffect(() => {
    let active = true;
    if (!settings.location) setAutomatic({ language: 'en', country: null });
    else
      void locateLanguage(settings.location.latitude, settings.location.longitude)
        .then((result) => {
          if (active) setAutomatic(result);
        })
        .catch(() => {
          if (active) setAutomatic({ language: 'en', country: null });
        });
    return () => {
      active = false;
    };
  }, [settings.location]);
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY || event.key === null)
        setMode(parseLanguage(readLocal(LANGUAGE_KEY)));
    };
    window.addEventListener('storage', storage);
    let active = true;
    let permission: PermissionStatus | undefined;
    const changed = () => {
      if (permission?.state === 'denied') updateRef.current({ location: null });
    };
    // Querying permission never prompts or requests a new position.
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((result) => {
        if (!active) return;
        permission = result;
        changed();
        permission.addEventListener('change', changed);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener('storage', storage);
      permission?.removeEventListener('change', changed);
    };
  }, []);
  const choose = (next: LanguageMode) => {
    setMode(next);
    setPersistent(writeLocal(LANGUAGE_KEY, next));
  };
  return (
    <Context.Provider
      value={{
        mode,
        language,
        country: automatic.country,
        persistent,
        choose,
        loading,
        loadFailed,
        retry: () => setAttempt((previous) => previous + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
