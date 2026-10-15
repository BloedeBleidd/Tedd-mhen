import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { locale, t as tr } from '../i18n';
import { MapPin, Moon, Sun, Sunrise, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAppearance } from '../lib/appearance-context';
import type { ThemeMode } from '../lib/appearance';

export function AppearanceControl({ disabled = false }: { disabled?: boolean }) {
  useTranslation();
  const { settings, update, resolved, persistent } = useAppearance();
  const dialog = useRef<HTMLDialogElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const Icon = resolved.theme === 'dark' ? Moon : Sun;
  function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('appearanceControl:locationIsUnavailableInThisBrowserYouCanStill');
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
        if (cause.code === 1) update({ location: null });
        setError(
          cause.code === 1
            ? 'appearanceControl:locationPermissionWasNotGrantedAutoFollowsYourSystem'
            : 'appearanceControl:couldNotGetYourLocationTryAgainOrChoose',
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
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
        aria-label={tr('appearanceControl:appearance')}
      >
        <Icon size={16} />
        <span>{tr('appearanceControl:appearance')}</span>
      </button>
      <dialog ref={dialog} className="appearance-dialog" aria-labelledby="appearance-title">
        <div className="dialog-heading">
          <h2 id="appearance-title">{tr('appearanceControl:appearance')}</h2>
          <button
            className="icon-button"
            aria-label={tr('appearanceControl:closeAppearance')}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">{tr('appearanceControl:aLighterDayAQuieterEvening')}</p>
        <fieldset className="theme-options">
          <legend className="sr-only">{tr('appearanceControl:theme')}</legend>
          {(
            [
              { mode: 'auto', label: tr('appearanceControl:auto'), icon: Sunrise },
              { mode: 'light', label: tr('appearanceControl:light'), icon: Sun },
              { mode: 'dark', label: tr('appearanceControl:dark'), icon: Moon },
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
            ? tr('appearanceControl:staysOnUntilYouChangeIt', {
                value0:
                  resolved.theme === 'light'
                    ? tr('appearanceControl:light')
                    : tr('appearanceControl:dark'),
              })
            : resolved.source === 'fallback'
              ? tr('appearanceControl:autoIsFollowingYourSystemThemeAddALocation')
              : resolved.polar
                ? tr(
                    resolved.polar === 'day'
                      ? 'appearanceControl:polarDay'
                      : 'appearanceControl:polarNight',
                  )
                : resolved.next
                  ? `${resolved.next.theme === 'dark' ? tr('appearanceControl:darkAtSunset') : tr('appearanceControl:lightAtSunrise')} · ${resolved.next.at.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`
                  : tr('appearanceControl:autoFollowsSunriseAndSunset')}
        </p>
        <div className="location-settings">
          <h3>{tr('appearanceControl:followYourLocalSunriseSunset')}</h3>
          <p>{tr('appearanceControl:locationIsRequestedOnlyWhenYouClickBelowApproximate')}</p>
          <button className="button secondary" disabled={locating} onClick={locate}>
            <MapPin size={16} />
            {locating
              ? tr('appearanceControl:findingLocation')
              : settings.location
                ? tr('appearanceControl:updateDeviceLocation')
                : tr('appearanceControl:useDeviceLocation')}
          </button>
          {settings.location && (
            <>
              <p>
                <Trans
                  i18nKey="appearanceControl:savedOnUpdateWhenTravellingThereIsNoBackground"
                  components={{
                    slot0: (
                      <MessageValue
                        value={new Date(settings.location.capturedAt).toLocaleDateString(locale())}
                      />
                    ),
                  }}
                />
              </p>
              <button
                className="text-link"
                disabled={locating}
                onClick={() => {
                  update({ location: null });
                  setError('');
                }}
              >
                {tr('appearanceControl:forgetSavedLocation')}
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {tr(error)}
          </p>
        )}
        {!persistent && (
          <p role="status" className="muted">
            {tr('appearanceControl:browserStorageIsUnavailableChangesApplyToThisTab')}
          </p>
        )}
      </dialog>
    </>
  );
}
