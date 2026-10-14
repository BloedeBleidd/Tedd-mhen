import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  APPEARANCE_KEY,
  applyTheme,
  parseAppearance,
  readLocal,
  resolveAppearance,
  writeLocal,
  type Appearance,
} from './appearance';

const Context = createContext<{
  settings: Appearance;
  update: (change: Partial<Appearance>) => void;
  resolved: ReturnType<typeof resolveAppearance>;
  persistent: boolean;
}>(null!);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => parseAppearance(readLocal(APPEARANCE_KEY)));
  const [persistent, setPersistent] = useState(true);
  const latestSettings = useRef(settings);
  latestSettings.current = settings;
  const [now, setNow] = useState(() => new Date());
  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const resolved = resolveAppearance(settings, now, systemDark);
  useLayoutEffect(() => applyTheme(resolved.theme), [resolved.theme]);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const media = matchMedia('(prefers-color-scheme: dark)');
    const systemChange = () => setSystemDark(media.matches);
    const storageChange = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) {
        setSettings(parseAppearance(readLocal(APPEARANCE_KEY)));
        refresh();
      }
    };
    media.addEventListener('change', systemChange);
    window.addEventListener('storage', storageChange);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      media.removeEventListener('change', systemChange);
      window.removeEventListener('storage', storageChange);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    const delay = resolved.next
      ? Math.min(60000, Math.max(50, resolved.next.at.getTime() - Date.now() + 50))
      : 60000;
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [now, settings, resolved.next]);
  const update = (change: Partial<Appearance>) => {
    const next = { ...latestSettings.current, ...change };
    latestSettings.current = next;
    setSettings(next);
    setNow(new Date());
    setPersistent(writeLocal(APPEARANCE_KEY, JSON.stringify(next)));
  };
  return (
    <Context.Provider value={{ settings, update, resolved, persistent }}>
      {children}
    </Context.Provider>
  );
}
export const useAppearance = () => useContext(Context);
