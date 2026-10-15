import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { checkInFields, fieldRecorded, type CheckInField } from '../../shared/preferences';
import { scaleDefinitions, type Entry, type ScaleKey } from '../../shared/schema';
import { useApi } from '../lib/api';
import { usePreferences } from '../lib/preferences-context';
import { localize, t } from '../i18n';

const labels: Partial<Record<CheckInField, string>> = {
  labels: 'labelsEditor:recordContextLabels',
  notes: 'checkIn:dailyNotes',
  'sleep.durationMinutes': 'checkIn:actualSleepMinutes',
  'sleep.bedtime': 'checkIn:bedtime',
  'sleep.wakeTime': 'checkIn:wakeTime',
  'sleep.latencyMinutes': 'checkIn:timeToFallAsleepMin',
  'sleep.awakenings': 'checkIn:awakenings',
  'sleep.score': 'checkIn:deviceSleepScore0100',
  'sleep.quality': 'checkIn:perceivedSleepQuality',
  sleepNotes: 'checkIn:sleepNotes',
  'physiology.hrv': 'checkIn:hrvMs',
  'physiology.restingHeartRate': 'checkIn:restingHeartRateBpm',
  'physiology.respiratoryRate': 'checkIn:respiratoryRateBreathsMin',
  'physiology.temperatureC': 'checkIn:temperatureC',
  'physiology.weightKg': 'checkIn:bodyWeightKg',
  symptoms: 'personalization:symptoms',
  illnessNotes: 'checkIn:illnessNotes',
  trainingStatus: 'checkIn:training',
};
function fieldLabel(field: CheckInField) {
  if (field === 'labels') return t('personalization:contextLabels');
  return labels[field] ? t(labels[field]!) : localize(scaleDefinitions[field as ScaleKey].label);
}
export function useFieldVisible(entry: Entry) {
  const { preferences } = usePreferences();
  return (field: CheckInField) =>
    preferences.fields[field] !== false || fieldRecorded(entry, field);
}
export function CheckInPersonalization({ entry }: { entry: Entry }) {
  useTranslation();
  const { demo } = useApi();
  const { preferences, change, loaded } = usePreferences();
  const [open, setOpen] = useState(false);
  return (
    <section className="personalization-panel">
      <button
        type="button"
        className="button secondary"
        aria-expanded={open}
        aria-controls="checkin-personalization"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={18} />
        {t('personalization:customize')}
      </button>
      <p className="small muted">{t(demo ? 'personalization:demo' : 'personalization:account')}</p>
      {Object.keys(preferences.fields).length === 0 && (
        <p className="small muted">{t('personalization:firstUse')}</p>
      )}
      {open && (
        <div id="checkin-personalization">
          <p>{t('personalization:explanation')}</p>
          <fieldset className="form-fieldset" disabled={!loaded}>
            {Object.entries(checkInFields).map(([group, fields]) => (
              <fieldset className="preference-group" key={group}>
                <legend>{t(`personalization:${group}`)}</legend>
                <div className="preference-choices">
                  {fields.map((id) => (
                    <label key={id} className="check-label">
                      <input
                        type="checkbox"
                        checked={preferences.fields[id] !== false}
                        onChange={(event) =>
                          change({ kind: 'field', id, visible: event.target.checked })
                        }
                      />
                      {fieldLabel(id)}
                      {preferences.fields[id] === false && fieldRecorded(entry, id) && (
                        <small>{t('personalization:recordedVisible')}</small>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </fieldset>
        </div>
      )}
    </section>
  );
}
