import { CheckInPersonalization, useFieldVisible } from '../components/CheckInPersonalization';
import { usePreferences } from '../lib/preferences-context';
import { checkInFields, personalizedEntry, initialRatingChoices } from '../../shared/preferences';
import type { HabitDefinition } from '../../shared/habits';
import { HabitsEditor } from '../components/HabitsEditor';
import { CheckInReview } from '../components/CheckInReview';
import { reviewCheckIn } from '../../shared/checkin-review';
import { useLoad } from '../lib/api';
import { shiftDate, type EntrySummary } from '../../shared/schema';
import { MessageValue } from '../components/MessageValue';
import { ActivitySelect } from '../components/ActivitySelect';
import { supportsSets, supportsDistance } from '../../shared/activities';
import { useTranslation, Trans } from 'react-i18next';
import { enumLabel, t as tr } from '../i18n';
import { invalidField } from '../lib/form-feedback';
import { LabelsEditor } from '../components/LabelsEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useLocation, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Dumbbell, Heart, Moon, Plus, Save, Trash2 } from 'lucide-react';
import { ApiError, useApi } from '../lib/api';
import {
  emptyEntry,
  entrySchema,
  dateSchema,
  localDate,
  scaleDefinitions,
  symptomTypes,
  workoutTypes,
  type Entry,
  type ScaleKey,
  type StoredEntry,
  type Workout,
} from '../../shared/schema';
import { ErrorBox, Field, Loading, NumberField, PageHeading, Panel, Scale } from '../components/ui';
const humanize = enumLabel;
export function CheckIn() {
  useTranslation();
  const [params, setParams] = useSearchParams(),
    date = params.get('date') || localDate();
  const validDate = dateSchema.safeParse(date).success;
  const { hash } = useLocation();
  const errorRef = useRef<HTMLDivElement>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { request, invalidate, demo } = useApi();
  const [entry, setEntry] = useState<Entry>(() => emptyEntry(date)),
    [revision, setRevision] = useState(0);
  const preferencesState = usePreferences();
  const {
    preferences,
    loaded: preferencesLoaded,
    change: changePreference,
    remember,
    rank,
  } = preferencesState;
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const visible = useFieldVisible(entry);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [dirty, setDirty] = useState(false),
    [loadFailed, setLoadFailed] = useState(false);
  const history = useLoad<{ entries: EntrySummary[] }>(
    validDate ? `/api/series?from=${shiftDate(date, -90)}&to=${shiftDate(date, -1)}` : null,
  );
  const [reviewEntry, setReviewEntry] = useState(entry);
  const [reviewOpen, setReviewOpen] = useState(false),
    [confirmedReview, setConfirmedReview] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setReviewEntry(entry), 400);
    return () => clearTimeout(timer);
  }, [entry]);
  const review = useMemo(
    () => reviewCheckIn(reviewEntry, history.data?.entries || []),
    [reviewEntry, history.data],
  );
  const reviewSignature = JSON.stringify([entry, history.data]);
  const reviewConfirmed = confirmedReview === reviewSignature;
  const requestRef = useRef(request);
  requestRef.current = request;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || saving) &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (saving) {
      setError('checkIn:waitForTheCurrentSaveToFinishBeforeChanging');
      blocker.reset();
      return;
    }
    if (window.confirm(tr('checkIn:discardYourUnsavedCheckIn'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, saving]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSaved(false);
    setError(null);
    setDirty(false);
    setLoadFailed(false);
    setReviewOpen(false);
    setConfirmedReview('');
    if (!validDate) {
      setLoading(false);
      setLoadFailed(true);
      setError('checkIn:chooseAValidJournalDate');
      return;
    }
    if (!preferencesLoaded) return;
    requestRef
      .current<StoredEntry>(`/api/entries/${date}`)
      .then((data) => {
        if (!active) return;
        const { revision, createdAt: _c, updatedAt: _u, ...entry } = data;
        const loaded = { ...entry, habits: entry.habits || [] };
        setEntry(loaded);
        setReviewEntry(loaded);
        setRevision(revision);
      })
      .catch(async (err) => {
        if (!active) return;
        let blank = emptyEntry(date);
        if (err instanceof ApiError && err.status === 404) {
          try {
            const library = await requestRef.current<{ definitions: HabitDefinition[] }>(
              '/api/habit-definitions',
            );
            if (!active) return;
            blank = personalizedEntry(date, preferencesRef.current, library.definitions);
          } catch (cause) {
            if (!active) return;
            setError((cause as Error).message);
            setLoadFailed(true);
          }
        }
        setEntry(blank);
        setReviewEntry(blank);
        setRevision(0);
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(err.message);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, demo, validDate, loadAttempt, preferencesLoaded]);
  useEffect(() => {
    if (
      loading ||
      ![
        '#habits',
        '#daily-ratings',
        '#sleep',
        '#body-signals',
        '#training',
        '#custom-habits',
      ].includes(hash)
    )
      return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(hash === '#body-signals' ? 'sleep' : hash.slice(1))
        ?.scrollIntoView({ block: 'start' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [loading, hash, date]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty, saving]);
  function update<K extends keyof Entry>(key: K, value: Entry[K]) {
    setEntry((e) => ({ ...e, [key]: value }));
    setDirty(true);
    setSaved(false);
  }
  const sleep = <K extends keyof Entry['sleep']>(key: K, value: Entry['sleep'][K]) =>
    update('sleep', { ...entry.sleep, [key]: value });
  const physiology = <K extends keyof Entry['physiology']>(key: K, value: Entry['physiology'][K]) =>
    update('physiology', { ...entry.physiology, [key]: value });
  function editWorkout(index: number, patch: Partial<Workout>) {
    update(
      'workouts',
      entry.workouts.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    );
  }
  function addWorkout() {
    setEntry((e) => ({
      ...e,
      trainingStatus: 'trained',
      workouts: [
        ...e.workouts,
        {
          id: crypto.randomUUID(),
          type: rank(workoutTypes, 'activity', (value) => value)[0],
          title: '',
          durationMinutes: 0,
          distanceKm: null,
          effort: null,
          pain: null,
          averageHeartRate: null,
          sets: [],
          notes: '',
        },
      ],
    }));
    setDirty(true);
    setSaved(false);
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || loadFailed || history.loading) return;
    const invalid = invalidField(e.currentTarget);
    if (invalid) {
      setError(invalid);
      requestAnimationFrame(() => {
        errorRef.current?.focus();
        errorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      return;
    }
    setError(null);
    setSaved(false);
    const parsed = entrySchema.safeParse(entry);
    if (!parsed.success) {
      setError(JSON.stringify(parsed.error.issues));
      requestAnimationFrame(() => {
        errorRef.current?.focus();
        errorRef.current?.scrollIntoView({ block: 'center' });
      });
      return;
    }
    const latestReview = reviewCheckIn(parsed.data, history.data?.entries || []);
    if (latestReview.warnings.length && !reviewConfirmed) {
      setReviewEntry(entry);
      setReviewOpen(true);
      requestAnimationFrame(() => {
        document.getElementById('checkin-review')?.focus();
        document.getElementById('checkin-review')?.scrollIntoView({ block: 'center' });
      });
      return;
    }
    setSaving(true);
    try {
      const result = await request<{ revision: number }>(`/api/entries/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ entry: parsed.data, revision }),
      });
      if (revision === 0) {
        for (const choice of initialRatingChoices(parsed.data, preferencesRef.current))
          changePreference(choice);
      }
      for (const type of new Set(parsed.data.workouts.map((workout) => workout.type)))
        remember('activity', type);
      for (const habit of parsed.data.habits) {
        if (habit.count !== null || habit.durationMinutes !== null || habit.times.length > 0)
          remember('habit', habit.key);
      }
      setRevision(result.revision);
      setDirty(false);
      setSaved(true);
      setError(null);
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (saving || loadFailed) return;
    if (
      !window.confirm(
        tr('checkIn:permanentlyDeleteTheEntryForThisCannotBeUndone', { value0: date }),
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await request(`/api/entries/${date}?revision=${revision}`, { method: 'DELETE' });
      setEntry(emptyEntry(date));
      setRevision(0);
      setDirty(false);
      setSaved(false);
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={tr('checkIn:aMomentForYourself')}
        title={tr('checkIn:howWasYourDay')}
        description={tr('checkIn:startWithTheNumbersAddALittleContextIf')}
        action={
          <Field label={tr('checkIn:journalDate')}>
            <input
              aria-label={tr('checkIn:journalDate')}
              type="date"
              disabled={saving}
              value={validDate ? date : ''}
              onChange={(e) => {
                if (e.target.value) setParams({ date: e.target.value });
              }}
            />
          </Field>
        }
      />
      <nav className="checkin-sections" aria-label={tr('checkIn:checkInSections')}>
        {checkInFields.ratings.some(visible) && (
          <a href="#daily-ratings">{tr('checkIn:dailyRatings')}</a>
        )}
        {checkInFields.sleep.some(visible) && <a href="#sleep">{tr('personalization:sleep')}</a>}
        {visible('trainingStatus') && <a href="#training">{tr('checkIn:training')}</a>}
        <a href="#habits">{tr('personalization:habits')}</a>
        <a href="#custom-habits">{tr('personalization:custom')}</a>
      </nav>
      <CheckInPersonalization entry={entry} />
      {loading ? (
        <Loading />
      ) : (
        <form noValidate onSubmit={save}>
          <fieldset className="form-fieldset" disabled={saving || loadFailed}>
            <div className="checkin-layout">
              <div className="checkin-main">
                {checkInFields.ratings.some(visible) && (
                  <Panel
                    id="daily-ratings"
                    title={tr('checkIn:dailyRatings')}
                    subtitle={tr('checkIn:checkAMetricToRecordItUncheckedMetricsRemain')}
                  >
                    <div className="section-icon">
                      <Heart size={20} />
                    </div>
                    <div className="scales-grid">
                      {(Object.keys(scaleDefinitions) as ScaleKey[])
                        .filter((k) => k !== 'illnessSeverity' && visible(k))
                        .map((key) => (
                          <Scale
                            key={key}
                            {...scaleDefinitions[key]}
                            value={entry[key]}
                            onChange={(v) => {
                              update(key, v);
                              if ((v !== null) !== (entry[key] !== null))
                                changePreference({ kind: 'field', id: key, visible: v !== null });
                            }}
                          />
                        ))}
                    </div>
                    {visible('labels') && (
                      <LabelsEditor
                        value={entry.labels ?? null}
                        onChange={(value) => update('labels', value)}
                      />
                    )}
                    {visible('notes') && (
                      <details className="notes-details">
                        <summary>
                          <Trans
                            i18nKey="checkIn:additionalContextOptional"
                            components={{ slot0: <span />, slot1: <ChevronDown size={15} /> }}
                          />
                        </summary>
                        <Field label={tr('checkIn:dailyNotes')}>
                          <textarea
                            value={entry.notes}
                            onChange={(e) => update('notes', e.target.value)}
                            maxLength={50000}
                            rows={4}
                            placeholder={tr('checkIn:anythingTheNumbersDonTCapture')}
                          />
                        </Field>
                      </details>
                    )}
                  </Panel>
                )}
                {checkInFields.sleep.some(visible) && (
                  <Panel
                    id="sleep"
                    title={tr('personalization:sleep')}
                    subtitle={tr('checkIn:recordSleepAgainstTheDayYouWokeUp')}
                  >
                    <div className="section-icon">
                      <Moon size={20} />
                    </div>
                    <div className="fields-grid three">
                      {visible('sleep.durationMinutes') && (
                        <NumberField
                          label={tr('checkIn:actualSleepMinutes')}
                          value={entry.sleep.durationMinutes}
                          onChange={(v) => sleep('durationMinutes', v)}
                          max={1440}
                          hint={
                            entry.sleep.durationMinutes !== null
                              ? tr('checkIn:hMin', {
                                  value0: Math.floor(entry.sleep.durationMinutes / 60),
                                  value1: entry.sleep.durationMinutes % 60,
                                })
                              : tr('checkIn:totalTimeAsleepExcludingAwakenings')
                          }
                        />
                      )}
                      {visible('sleep.bedtime') && (
                        <Field label={tr('checkIn:bedtime')}>
                          <input
                            type="time"
                            value={entry.sleep.bedtime || ''}
                            onChange={(e) => sleep('bedtime', e.target.value || null)}
                          />
                        </Field>
                      )}
                      {visible('sleep.wakeTime') && (
                        <Field label={tr('checkIn:wakeTime')}>
                          <input
                            type="time"
                            value={entry.sleep.wakeTime || ''}
                            onChange={(e) => sleep('wakeTime', e.target.value || null)}
                          />
                        </Field>
                      )}
                      {visible('sleep.latencyMinutes') && (
                        <NumberField
                          label={tr('checkIn:timeToFallAsleepMin')}
                          value={entry.sleep.latencyMinutes}
                          onChange={(v) => sleep('latencyMinutes', v)}
                          max={720}
                        />
                      )}
                      {visible('sleep.awakenings') && (
                        <NumberField
                          label={tr('checkIn:awakenings')}
                          value={entry.sleep.awakenings}
                          onChange={(v) => sleep('awakenings', v)}
                          max={100}
                        />
                      )}
                      {visible('sleep.score') && (
                        <NumberField
                          label={tr('checkIn:deviceSleepScore0100')}
                          value={entry.sleep.score}
                          onChange={(v) => sleep('score', v)}
                          max={100}
                        />
                      )}
                    </div>
                    {visible('sleep.quality') && (
                      <Scale
                        label={tr('checkIn:perceivedSleepQuality')}
                        min={1}
                        low={tr('checkIn:veryPoor')}
                        high={tr('checkIn:excellent')}
                        value={entry.sleep.quality}
                        onChange={(v) => {
                          sleep('quality', v);
                          if ((v !== null) !== (entry.sleep.quality !== null))
                            changePreference({
                              kind: 'field',
                              id: 'sleep.quality',
                              visible: v !== null,
                            });
                        }}
                      />
                    )}
                    {visible('sleepNotes') && (
                      <details className="notes-details">
                        <summary>
                          <Trans
                            i18nKey="checkIn:sleepContextOptional"
                            components={{ slot0: <span />, slot1: <ChevronDown size={15} /> }}
                          />
                        </summary>
                        <textarea
                          aria-label={tr('checkIn:sleepNotes')}
                          value={entry.sleepNotes}
                          onChange={(e) => update('sleepNotes', e.target.value)}
                          maxLength={50000}
                          rows={3}
                        />
                      </details>
                    )}
                    <div className="divider" />
                    <p className="small muted">
                      {tr('checkIn:useTheSameDeviceMethodAndMeasurementRoutineWhere')}
                    </p>
                    <div className="fields-grid three">
                      {visible('physiology.hrv') && (
                        <NumberField
                          label={tr('checkIn:hrvMs')}
                          value={entry.physiology.hrv}
                          onChange={(v) => physiology('hrv', v)}
                          min={1}
                          max={500}
                          step={0.1}
                        />
                      )}
                      {visible('physiology.hrv') && (
                        <Field label={tr('checkIn:hrvMethod')}>
                          <select
                            value={entry.physiology.hrvMethod}
                            onChange={(e) => {
                              remember('hrvMethod', e.target.value);
                              physiology(
                                'hrvMethod',
                                e.target.value as Entry['physiology']['hrvMethod'],
                              );
                            }}
                          >
                            {rank(['unknown', 'rmssd', 'sdnn'], 'hrvMethod', (value) => value).map(
                              (value) => (
                                <option key={value} value={value}>
                                  {tr(
                                    `checkIn:${value === 'unknown' ? 'unknownNotSpecified' : value}`,
                                  )}
                                </option>
                              ),
                            )}
                          </select>
                        </Field>
                      )}
                      {(checkInFields.sleep.some(
                        (id) => id.startsWith('physiology.') && visible(id),
                      ) ||
                        visible('sleep.score')) && (
                        <Field label={tr('checkIn:measurementSource')}>
                          <select
                            value={entry.physiology.source}
                            onChange={(e) => {
                              remember('source', e.target.value);
                              physiology('source', e.target.value as Entry['physiology']['source']);
                            }}
                          >
                            {rank(
                              ['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'],
                              'source',
                              (value) => value,
                            ).map((s) => (
                              <option key={s} value={s}>
                                {humanize(s)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {visible('physiology.restingHeartRate') && (
                        <NumberField
                          label={tr('checkIn:restingHeartRateBpm')}
                          value={entry.physiology.restingHeartRate}
                          onChange={(v) => physiology('restingHeartRate', v)}
                          min={20}
                          max={250}
                        />
                      )}
                      {visible('physiology.respiratoryRate') && (
                        <NumberField
                          label={tr('checkIn:respiratoryRateBreathsMin')}
                          value={entry.physiology.respiratoryRate}
                          onChange={(v) => physiology('respiratoryRate', v)}
                          min={3}
                          max={60}
                          step={0.1}
                        />
                      )}
                      {visible('physiology.temperatureC') && (
                        <NumberField
                          label={tr('checkIn:temperatureC')}
                          value={entry.physiology.temperatureC}
                          onChange={(v) => physiology('temperatureC', v)}
                          min={30}
                          max={45}
                          step={0.1}
                        />
                      )}
                      {visible('physiology.weightKg') && (
                        <NumberField
                          label={tr('checkIn:bodyWeightKg')}
                          value={entry.physiology.weightKg}
                          onChange={(v) => physiology('weightKg', v)}
                          min={20}
                          max={400}
                          step={0.1}
                        />
                      )}
                    </div>
                    <div className="divider" />
                    {visible('illnessSeverity') && (
                      <Scale
                        {...scaleDefinitions.illnessSeverity}
                        value={entry.illnessSeverity}
                        onChange={(v) => {
                          update('illnessSeverity', v);
                          if ((v !== null) !== (entry.illnessSeverity !== null))
                            changePreference({
                              kind: 'field',
                              id: 'illnessSeverity',
                              visible: v !== null,
                            });
                        }}
                      />
                    )}
                    {visible('symptoms') && (
                      <>
                        {' '}
                        <p className="field-label">
                          <Trans
                            i18nKey="checkIn:specificSymptomsSelectToRateSeverity"
                            components={{ slot0: <span className="muted" /> }}
                          />
                        </p>
                        <div className="symptom-options">
                          {rank(symptomTypes, 'symptom', (value) => value).map((name) => (
                            <label
                              className={`choice-chip ${entry.symptoms.some((s) => s.name === name) ? 'selected' : ''}`}
                              key={name}
                            >
                              <input
                                type="checkbox"
                                checked={entry.symptoms.some((s) => s.name === name)}
                                onChange={(e) => {
                                  if (e.target.checked) remember('symptom', name);
                                  update(
                                    'symptoms',
                                    e.target.checked
                                      ? [...entry.symptoms, { name, severity: 1 }]
                                      : entry.symptoms.filter((s) => s.name !== name),
                                  );
                                }}
                              />
                              {humanize(name)}
                            </label>
                          ))}
                        </div>
                        <div className="scales-grid">
                          {entry.symptoms.map((s) => (
                            <Scale
                              key={s.name}
                              label={humanize(s.name)}
                              min={1}
                              low={tr('checkIn:mild')}
                              high={tr('checkIn:severe')}
                              value={s.severity}
                              onChange={(v) =>
                                update(
                                  'symptoms',
                                  v === null
                                    ? entry.symptoms.filter((item) => item.name !== s.name)
                                    : entry.symptoms.map((item) =>
                                        item.name === s.name ? { ...item, severity: v } : item,
                                      ),
                                )
                              }
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {visible('illnessNotes') && (
                      <details className="notes-details">
                        <summary>
                          <Trans
                            i18nKey="checkIn:symptomContextOptional"
                            components={{ slot0: <span />, slot1: <ChevronDown size={15} /> }}
                          />
                        </summary>
                        <textarea
                          aria-label={tr('checkIn:illnessNotes')}
                          value={entry.illnessNotes}
                          onChange={(e) => update('illnessNotes', e.target.value)}
                          maxLength={50000}
                          rows={3}
                        />
                      </details>
                    )}
                  </Panel>
                )}
                {visible('trainingStatus') && (
                  <Panel
                    id="training"
                    title={tr('personalization:training')}
                    subtitle={tr('checkIn:anExplicitRestDayIsAUsefulObservationToo')}
                  >
                    <div className="section-icon">
                      <Dumbbell size={20} />
                    </div>
                    <Field label={tr('checkIn:trainingStatus')}>
                      <select
                        value={entry.trainingStatus}
                        onChange={(e) => {
                          if (entry.workouts.length && e.target.value !== 'trained') {
                            setError('checkIn:removeTheWorkoutsBeforeMarkingARestOrUnrecorded');
                            return;
                          }
                          remember('trainingStatus', e.target.value);
                          update('trainingStatus', e.target.value as Entry['trainingStatus']);
                        }}
                      >
                        {rank(
                          ['unrecorded', 'rest', 'trained'],
                          'trainingStatus',
                          (value) => value,
                        ).map((value) => (
                          <option key={value} value={value}>
                            {tr(
                              `checkIn:${value === 'unrecorded' ? 'notRecorded' : value === 'rest' ? 'restDay' : 'trained'}`,
                            )}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {entry.workouts.map((w, index) => (
                      <div className="workout-editor" key={w.id}>
                        <div className="workout-heading">
                          <h3>
                            <Trans
                              i18nKey="checkIn:session"
                              components={{ slot0: <MessageValue value={index + 1} /> }}
                            />
                          </h3>
                          <button
                            type="button"
                            className="icon-button danger-text"
                            aria-label={tr('checkIn:removeSession', { value0: index + 1 })}
                            onClick={() =>
                              update(
                                'workouts',
                                entry.workouts.filter((item) => item.id !== w.id),
                              )
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="fields-grid">
                          <div className="field">
                            <span>{tr('checkIn:activity')}</span>
                            <ActivitySelect
                              value={w.type}
                              onChange={(type) => {
                                if (type !== 'all') editWorkout(index, { type });
                              }}
                            />
                          </div>
                          <Field label={tr('checkIn:sessionTitleOptional')}>
                            <input
                              value={w.title}
                              onChange={(e) => editWorkout(index, { title: e.target.value })}
                              maxLength={120}
                              placeholder={tr('checkIn:eGEasyRun')}
                            />
                          </Field>
                          <NumberField
                            label={tr('checkIn:durationMinutes')}
                            value={w.durationMinutes || null}
                            onChange={(v) => editWorkout(index, { durationMinutes: v ?? 0 })}
                            min={1}
                            max={1440}
                          />
                          {(supportsDistance(w.type) || w.distanceKm !== null) && (
                            <NumberField
                              label={tr('checkIn:distanceKm')}
                              value={w.distanceKm}
                              onChange={(v) => editWorkout(index, { distanceKm: v })}
                              max={1000}
                              step={0.01}
                            />
                          )}
                          <NumberField
                            label={tr('checkIn:averageHeartRateBpm')}
                            value={w.averageHeartRate}
                            onChange={(v) => editWorkout(index, { averageHeartRate: v })}
                            min={25}
                            max={250}
                          />
                        </div>
                        {((!supportsDistance(w.type) && w.distanceKm !== null) ||
                          (!supportsSets(w.type) && w.sets.length > 0)) && (
                          <p className="small muted">{tr('personalization:retainedSportFields')}</p>
                        )}
                        <div className="scales-grid">
                          <Scale
                            label={tr('checkIn:perceivedEffort')}
                            min={1}
                            low={tr('checkIn:veryEasy')}
                            high={tr('checkIn:maximal')}
                            value={w.effort}
                            onChange={(v) => editWorkout(index, { effort: v })}
                          />
                          <Scale
                            label={tr('checkIn:painDuringTraining')}
                            low={tr('checkIn:none')}
                            high={tr('checkIn:extreme')}
                            value={w.pain}
                            onChange={(v) => editWorkout(index, { pain: v })}
                          />
                        </div>
                        {(supportsSets(w.type) || w.sets.length > 0) && (
                          <div className="strength-sets">
                            <p className="field-label">{tr('checkIn:exercisesSets')}</p>
                            {w.sets.map((set, si) => (
                              <div className="set-row" key={si}>
                                <Field label={tr('checkIn:exercise')}>
                                  <input
                                    value={set.exercise}
                                    maxLength={120}
                                    onChange={(e) =>
                                      editWorkout(index, {
                                        sets: w.sets.map((s, j) =>
                                          j === si ? { ...s, exercise: e.target.value } : s,
                                        ),
                                      })
                                    }
                                  />
                                </Field>
                                {(['sets', 'reps', 'weightKg'] as const).map((key) => (
                                  <NumberField
                                    key={key}
                                    label={key === 'weightKg' ? 'kg' : humanize(key)}
                                    value={set[key]}
                                    min={key === 'weightKg' ? 0 : 1}
                                    max={key === 'sets' ? 100 : 1000}
                                    step={key === 'weightKg' ? 0.25 : 1}
                                    onChange={(v) =>
                                      editWorkout(index, {
                                        sets: w.sets.map((s, j) =>
                                          j === si ? { ...s, [key]: v ?? 0 } : s,
                                        ),
                                      })
                                    }
                                  />
                                ))}
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label={tr('checkIn:removeExercise', { value0: si + 1 })}
                                  onClick={() =>
                                    editWorkout(index, { sets: w.sets.filter((_, j) => j !== si) })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="button secondary small-button"
                              onClick={() =>
                                editWorkout(index, {
                                  sets: [
                                    ...w.sets,
                                    { exercise: '', sets: 1, reps: 1, weightKg: 0 },
                                  ],
                                })
                              }
                            >
                              {tr('checkIn:addExercise')}
                            </button>
                          </div>
                        )}
                        <details className="notes-details">
                          <summary>
                            <Trans
                              i18nKey="checkIn:sessionNotesOptional"
                              components={{ slot0: <span />, slot1: <ChevronDown size={15} /> }}
                            />
                          </summary>
                          <textarea
                            aria-label={tr('checkIn:sessionNotes', { value0: index + 1 })}
                            value={w.notes}
                            maxLength={50000}
                            onChange={(e) => editWorkout(index, { notes: e.target.value })}
                            rows={3}
                          />
                        </details>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="button secondary add-session"
                      disabled={entry.workouts.length >= 20}
                      onClick={addWorkout}
                    >
                      <Trans
                        i18nKey="checkIn:addTrainingSession"
                        components={{ slot0: <Plus size={16} /> }}
                      />
                    </button>
                  </Panel>
                )}
                <HabitsEditor
                  key={`preset-${date}`}
                  kind="preset"
                  value={entry.habits || []}
                  onChange={(records) => update('habits', records)}
                />
                <HabitsEditor
                  key={`custom-${date}`}
                  kind="custom"
                  value={entry.habits || []}
                  onChange={(records) => update('habits', records)}
                />
              </div>
              <aside className="checkin-aside">
                <div className="checkin-tips">
                  <span className="eyebrow">{tr('checkIn:makeItARitual')}</span>
                  <h2>
                    <Trans
                      i18nKey="checkIn:consistencyOverPerfection"
                      components={{ slot0: <br /> }}
                    />
                  </h2>
                  <p>{tr('checkIn:checkInAtASimilarTimeEachDayUse')}</p>
                  <div className="divider" />
                  <strong>{tr('checkIn:missingIsOkay')}</strong>
                  <p>{tr('checkIn:leaveAFieldBlankIfYouHavenTMeasured')}</p>
                  <strong>{tr('checkIn:numbersFirstWordsSecond')}</strong>
                  <p>{tr('checkIn:yourRatingsPowerTheChartsNotesPreserveTheContext')}</p>
                  <span className="timezone-label">
                    <Trans
                      i18nKey="checkIn:timeZone"
                      components={{ slot0: <MessageValue value={entry.timezone} /> }}
                    />
                  </span>
                </div>
              </aside>
            </div>
          </fieldset>
          <CheckInReview
            result={review}
            loading={history.loading}
            unavailable={!!history.error}
            open={reviewOpen}
            setOpen={setReviewOpen}
            confirmed={reviewConfirmed}
            onConfirm={(checked) =>
              setConfirmedReview(checked ? JSON.stringify([reviewEntry, history.data]) : '')
            }
          />
          <div className="save-bar">
            <div aria-live="polite">
              {saved ? (
                <span className="saved-state">
                  <Check size={16} />
                  {demo ? tr('checkIn:savedInDemoMemory') : tr('checkIn:savedToYourJournal')}
                </span>
              ) : (
                <span className="muted">
                  {dirty
                    ? tr('checkIn:youHaveUnsavedChanges')
                    : revision
                      ? tr('checkIn:existingEntryRevision', { value0: revision })
                      : tr('checkIn:yourEntryIsNotSavedYet')}
                </span>
              )}
            </div>
            <div className="button-group">
              {revision > 0 && (
                <button
                  type="button"
                  className="button danger"
                  onClick={remove}
                  disabled={saving || loadFailed}
                >
                  <Trans i18nKey="checkIn:delete" components={{ slot0: <Trash2 size={16} /> }} />
                </button>
              )}
              {review.warnings.length > 0 && (
                <button
                  type="button"
                  className="button secondary small-button"
                  onClick={() => {
                    setReviewOpen(true);
                    document.getElementById('checkin-review')?.scrollIntoView({ block: 'center' });
                  }}
                >
                  {tr('checkinReview:reviewButton', { count: review.warnings.length })}
                </button>
              )}
              <button
                className="button primary"
                type="submit"
                disabled={saving || loadFailed || history.loading}
              >
                <Save size={16} />
                {saving
                  ? tr('checkIn:saving')
                  : history.loading
                    ? tr('checkinReview:loading')
                    : tr('checkIn:saveCheckIn')}
              </button>
            </div>
          </div>
          <div ref={errorRef} tabIndex={-1}>
            <ErrorBox message={error} />
          </div>
          {loadFailed && validDate && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setLoadAttempt((v) => v + 1)}
            >
              {tr('checkIn:retryLoadingThisDay')}
            </button>
          )}
        </form>
      )}
    </>
  );
}
