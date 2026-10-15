import { Globe2, MapPin, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, languageNames, t as tr } from '../i18n';
import { useLanguage, type LanguageMode } from '../lib/language-context';
import { useAppearance } from '../lib/appearance-context';

export function LanguageControl() {
  useTranslation();
  const { mode, language, choose, persistent, loading, loadFailed, retry } = useLanguage();
  const { settings, update } = useAppearance();
  const dialog = useRef<HTMLDialogElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('locationUnavailable');
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
        setError(cause.code === 1 ? 'locationDenied' : 'locationUnavailable');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  return (
    <>
      <button
        className="language-trigger button secondary small-button"
        aria-label={tr('language:open')}
        title={tr('language:open')}
        onClick={() => dialog.current?.showModal()}
      >
        <Globe2 className="language-globe" size={19} aria-hidden="true" />{' '}
        <span aria-hidden="true">{language.toUpperCase()}</span>
      </button>
      <dialog
        className="appearance-dialog language-dialog"
        ref={dialog}
        aria-labelledby="language-title"
      >
        <div className="dialog-heading">
          <h2 id="language-title">{tr('language:title')}</h2>
          <button
            className="icon-button"
            aria-label={tr('language:close')}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <fieldset className="language-options" aria-busy={loading}>
          <legend className="sr-only">{tr('language:title')}</legend>
          {(['auto', ...languages] as const).map((option) => (
            <label className={`theme-option ${mode === option ? 'selected' : ''}`} key={option}>
              <input
                type="radio"
                name="language"
                value={option}
                checked={mode === option}
                onChange={() => choose(option as LanguageMode)}
              />
              <span lang={option === 'auto' ? language : option}>
                {option === 'auto' ? tr('language:auto') : languageNames[option]}
              </span>
            </label>
          ))}
        </fieldset>
        <p role="status">
          {tr(mode === 'auto' ? 'language:automaticStatus' : 'language:manualStatus', {
            language: languageNames[language],
          })}
        </p>
        <p>{tr('language:locationExplanation')}</p>
        <button className="button secondary" disabled={locating} onClick={locate}>
          <MapPin size={16} />
          {tr(
            locating
              ? 'language:locating'
              : settings.location
                ? 'language:updateLocation'
                : 'language:useLocation',
          )}
        </button>
        {settings.location && (
          <button
            className="text-link language-forget"
            disabled={locating}
            onClick={() => {
              update({ location: null });
              setError('');
            }}
          >
            {tr('language:forgetLocation')}
          </button>
        )}
        <p className="muted small">{tr('language:approximation')}</p>
        {error && (
          <p role="alert" className="notice error">
            {tr(`language:${error}`)}
          </p>
        )}
        {loadFailed && (
          <div role="alert" className="notice error">
            <p>{tr('language:loadFailed')}</p>
            <button className="button secondary" onClick={retry}>
              {tr('language:retry')}
            </button>
          </div>
        )}
        {!persistent && <p role="status">{tr('language:storageUnavailable')}</p>}
      </dialog>
    </>
  );
}
