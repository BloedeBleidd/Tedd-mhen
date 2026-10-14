import { MapPin, Moon, Sun, Sunrise, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAppearance } from '../lib/appearance-context';
import type { ThemeMode } from '../lib/appearance';

export function AppearanceControl() {
  const { settings, update, resolved, persistent } = useAppearance();
  const dialog = useRef<HTMLDialogElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const Icon = resolved.theme === 'dark' ? Moon : Sun;
  function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('Location is unavailable in this browser. You can still choose Light or Dark.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({
          location: {
            latitude: Math.round(position.coords.latitude * 100) / 100,
            longitude: Math.round(position.coords.longitude * 100) / 100,
            capturedAt: new Date().toISOString(),
          },
        });
        setLocating(false);
      },
      (cause) => {
        setError(
          cause.code === 1
            ? 'Location permission was not granted. Auto follows your system theme until a location is saved.'
            : 'Could not get your location. Try again, or choose Light or Dark.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  return (
    <>
      <button
        className="appearance-trigger button secondary small-button"
        onClick={() => dialog.current?.showModal()}
        aria-label="Appearance"
      >
        <Icon size={16} />
        <span>Appearance</span>
      </button>
      <dialog ref={dialog} className="appearance-dialog" aria-labelledby="appearance-title">
        <div className="dialog-heading">
          <h2 id="appearance-title">Appearance</h2>
          <button
            className="icon-button"
            aria-label="Close appearance"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">A lighter day. A quieter evening.</p>
        <fieldset className="theme-options">
          <legend className="sr-only">Theme</legend>
          {(
            [
              { mode: 'auto', label: 'Auto', icon: Sunrise },
              { mode: 'light', label: 'Light', icon: Sun },
              { mode: 'dark', label: 'Dark', icon: Moon },
            ] as const
          ).map(({ mode, label, icon: OptionIcon }) => (
            <label
              key={mode}
              className={`theme-option ${settings.mode === mode ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="theme"
                value={mode}
                checked={settings.mode === mode}
                onChange={() => update({ mode: mode as ThemeMode })}
              />
              <OptionIcon size={20} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <p className="theme-status" role="status">
          {resolved.source === 'manual'
            ? `${resolved.theme === 'light' ? 'Light' : 'Dark'} stays on until you change it.`
            : resolved.source === 'system'
              ? 'Auto is following your system theme. Add a location to follow the sun.'
              : resolved.polar
                ? `Polar ${resolved.polar}: ${resolved.theme} mode stays on while the sun remains ${resolved.polar === 'day' ? 'above' : 'below'} the horizon.`
                : resolved.next
                  ? `${resolved.next.theme === 'dark' ? 'Dark at sunset' : 'Light at sunrise'} · ${resolved.next.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`
                  : 'Auto follows sunrise and sunset.'}
        </p>
        <div className="location-settings">
          <h3>Follow your local sunrise & sunset</h3>
          <p>
            Location is requested only when you click below. Approximate coordinates stay in this
            browser and are never sent to our database. Times are estimates.
          </p>
          <button className="button secondary" disabled={locating} onClick={locate}>
            <MapPin size={16} />
            {locating
              ? 'Finding location…'
              : settings.location
                ? 'Update device location'
                : 'Use device location'}
          </button>
          {settings.location && (
            <>
              <p>
                Saved on {new Date(settings.location.capturedAt).toLocaleDateString('en-GB')}.
                Update when travelling; there is no background location tracking.
              </p>
              <button
                className="text-link"
                disabled={locating}
                onClick={() => {
                  update({ location: null });
                  setError('');
                }}
              >
                Forget saved location
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {!persistent && (
          <p role="status" className="muted">
            Browser storage is unavailable. Changes apply to this tab only.
          </p>
        )}
      </dialog>
    </>
  );
}
