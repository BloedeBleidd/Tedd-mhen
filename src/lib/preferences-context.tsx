import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  emptyPreferences,
  mergePreference,
  preferenceKey,
  rankChoices,
  type ChoiceList,
  type PreferenceChange,
  type PreferenceRow,
  type Preferences,
} from '../../shared/preferences';
import { useApi } from './api';
import { t } from '../i18n';
import { useTranslation } from 'react-i18next';

type State = { preferences: Preferences; loaded: boolean; pending: boolean; error: boolean };
type ContextValue = State & {
  change: (change: PreferenceChange) => void;
  remember: (list: ChoiceList, value: string) => void;
  rank: <T>(items: readonly T[], list: ChoiceList, key: (item: T) => string) => T[];
  retry: () => void;
};
const Context = createContext<ContextValue | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { request } = useApi();
  const confirmed = useRef(emptyPreferences());
  const queue = useRef<{ change: PreferenceChange; time: number }[]>([]);
  const loadGeneration = useRef(0);
  const active = useRef(false),
    busy = useRef(false),
    ready = useRef(false);
  const [state, setState] = useState<State>({
    preferences: emptyPreferences(),
    loaded: false,
    pending: false,
    error: false,
  });
  const refresh = useCallback((error = false) => {
    if (!active.current) return;
    let prefs = confirmed.current;
    for (const { change, time } of queue.current) {
      const uses =
        change.kind === 'choice'
          ? (prefs.usage.find((u) => u.list === change.list && u.value === change.value)?.count ||
              0) + 1
          : 1;
      prefs = mergePreference(prefs, {
        key: preferenceKey(change),
        payload: JSON.stringify(change),
        uses,
        last_used: time,
      });
    }
    setState({
      preferences: prefs,
      loaded: ready.current,
      pending: queue.current.length > 0,
      error,
    });
  }, []);
  const flush = useCallback(async () => {
    if (busy.current || !ready.current) return;
    busy.current = true;
    try {
      while (active.current && queue.current.length) {
        const item = queue.current[0];
        const row = await request<PreferenceRow>('/api/preferences', {
          method: 'PATCH',
          body: JSON.stringify(item.change),
        });
        if (!active.current) return;
        confirmed.current = mergePreference(confirmed.current, row);
        queue.current.shift();
        refresh();
      }
    } catch {
      refresh(true);
    } finally {
      busy.current = false;
    }
  }, [request, refresh]);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const prefs = await request<Preferences>('/api/preferences');
      if (!active.current || generation !== loadGeneration.current) return;
      confirmed.current = prefs;
      ready.current = true;
      refresh();
    } catch {
      if (generation === loadGeneration.current) refresh(true);
    }
  }, [request, refresh]);
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
      loadGeneration.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!state.pending) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [state.pending]);
  const change = useCallback(
    (change: PreferenceChange) => {
      if (!active.current || !ready.current) return;
      queue.current.push({ change, time: Date.now() });
      refresh();
      void flush();
    },
    [refresh, flush],
  );
  return (
    <Context.Provider
      value={{
        ...state,
        change,
        remember: (list, value) => change({ kind: 'choice', list, value }),
        rank: (items, list, key) => rankChoices(items, list, state.preferences, key),
        retry: () => {
          if (ready.current) void flush();
          else void load();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  const context = useContext(Context);
  if (!context) throw new Error('Preferences require an authenticated or demo workspace.');
  return context;
}
export function PreferencesStatus() {
  useTranslation();
  const { pending, error, retry } = usePreferences();
  if (!pending && !error) return null;
  return (
    <div className="preferences-status" role={error ? 'alert' : 'status'}>
      <span>{t(error ? 'personalization:saveError' : 'personalization:saving')}</span>
      {error && (
        <button type="button" className="button secondary small-button" onClick={retry}>
          {t('personalization:retry')}
        </button>
      )}
    </div>
  );
}
