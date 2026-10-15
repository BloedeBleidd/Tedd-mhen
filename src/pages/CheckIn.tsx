import { invalidField } from '../lib/form-feedback';
import { LabelsEditor } from '../components/LabelsEditor';
import { useEffect, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Dumbbell, Heart, Moon, Plus, Save, Trash2, Waves } from 'lucide-react';
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
const humanize = (value: string) =>
  value.replaceAll('_', ' ').replace(/^./, (s) => s.toUpperCase());
export function CheckIn() {
  const [params, setParams] = useSearchParams(),
    date = params.get('date') || localDate();
  const validDate = dateSchema.safeParse(date).success;
  const errorRef = useRef<HTMLDivElement>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { request, invalidate, demo } = useApi();
  const [entry, setEntry] = useState<Entry>(() => emptyEntry(date)),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [dirty, setDirty] = useState(false),
    [loadFailed, setLoadFailed] = useState(false);
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
      setError('Wait for the current save to finish before changing pages.');
      blocker.reset();
      return;
    }
    if (window.confirm('Discard your unsaved check-in?')) blocker.proceed();
    else blocker.reset();
  }, [blocker, saving]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSaved(false);
    setError(null);
    setDirty(false);
    setLoadFailed(false);
    if (!validDate) {
      setLoading(false);
      setLoadFailed(true);
      setError('Choose a valid journal date.');
      return;
    }
    requestRef
      .current<StoredEntry>(`/api/entries/${date}`)
      .then((data) => {
        if (!active) return;
        const { revision, createdAt: _c, updatedAt: _u, ...entry } = data;
        setEntry(entry);
        setRevision(revision);
      })
      .catch((err) => {
        if (!active) return;
        setEntry(emptyEntry(date));
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
  }, [date, demo, validDate, loadAttempt]);
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
          type: 'running',
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
    if (saving || loadFailed) return;
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
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      requestAnimationFrame(() => {
        errorRef.current?.focus();
        errorRef.current?.scrollIntoView({ block: 'center' });
      });
      return;
    }
    setSaving(true);
    try {
      const result = await request<{ revision: number }>(`/api/entries/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ entry: parsed.data, revision }),
      });
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
      !window.confirm(`Permanently delete the entry for ${date}? This cannot be undone in the app.`)
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
        eyebrow="A MOMENT FOR YOURSELF"
        title="How was your day?"
        description="Start with the numbers. Add a little context if it helps."
        action={
          <Field label="Journal date">
            <input
              aria-label="Journal date"
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
      <nav className="checkin-sections" aria-label="Check-in sections">
        <a href="#daily-ratings">Daily ratings</a>
        <a href="#sleep">Sleep</a>
        <a href="#body-signals">Body signals & symptoms</a>
        <a href="#training">Training</a>
      </nav>
      {loading ? (
        <Loading />
      ) : (
        <form noValidate onSubmit={save}>
          <fieldset className="form-fieldset" disabled={saving || loadFailed}>
            <div className="checkin-layout">
              <div className="checkin-main">
                <Panel
                  id="daily-ratings"
                  title="01 · Your daily baseline"
                  subtitle="Check a metric to record it. Unchecked metrics remain unknown."
                >
                  <div className="section-icon">
                    <Heart size={20} />
                  </div>
                  <div className="scales-grid">
                    {(Object.keys(scaleDefinitions) as ScaleKey[])
                      .filter((k) => k !== 'illnessSeverity')
                      .map((key) => (
                        <Scale
                          key={key}
                          {...scaleDefinitions[key]}
                          value={entry[key]}
                          onChange={(v) => update(key, v)}
                        />
                      ))}
                  </div>
                  <LabelsEditor
                    value={entry.labels ?? null}
                    onChange={(value) => update('labels', value)}
                  />
                  <details className="notes-details">
                    <summary>
                      Additional context <span>Optional</span>
                      <ChevronDown size={15} />
                    </summary>
                    <Field label="Daily notes">
                      <textarea
                        value={entry.notes}
                        onChange={(e) => update('notes', e.target.value)}
                        maxLength={50000}
                        rows={4}
                        placeholder="Anything the numbers don't capture?"
                      />
                    </Field>
                  </details>
                </Panel>
                <Panel
                  id="sleep"
                  title="02 · Last night’s sleep"
                  subtitle="Record sleep against the day you woke up."
                >
                  <div className="section-icon">
                    <Moon size={20} />
                  </div>
                  <div className="fields-grid three">
                    <NumberField
                      label="Actual sleep (minutes)"
                      value={entry.sleep.durationMinutes}
                      onChange={(v) => sleep('durationMinutes', v)}
                      max={1440}
                      hint={
                        entry.sleep.durationMinutes !== null
                          ? `${Math.floor(entry.sleep.durationMinutes / 60)} h ${entry.sleep.durationMinutes % 60} min`
                          : 'Total time asleep, excluding awakenings'
                      }
                    />
                    <Field label="Bedtime">
                      <input
                        type="time"
                        value={entry.sleep.bedtime || ''}
                        onChange={(e) => sleep('bedtime', e.target.value || null)}
                      />
                    </Field>
                    <Field label="Wake time">
                      <input
                        type="time"
                        value={entry.sleep.wakeTime || ''}
                        onChange={(e) => sleep('wakeTime', e.target.value || null)}
                      />
                    </Field>
                    <NumberField
                      label="Time to fall asleep (min)"
                      value={entry.sleep.latencyMinutes}
                      onChange={(v) => sleep('latencyMinutes', v)}
                      max={720}
                    />
                    <NumberField
                      label="Awakenings"
                      value={entry.sleep.awakenings}
                      onChange={(v) => sleep('awakenings', v)}
                      max={100}
                    />
                    <NumberField
                      label="Device sleep score (0–100)"
                      value={entry.sleep.score}
                      onChange={(v) => sleep('score', v)}
                      max={100}
                    />
                  </div>
                  <Scale
                    label="Perceived sleep quality"
                    min={1}
                    low="Very poor"
                    high="Excellent"
                    value={entry.sleep.quality}
                    onChange={(v) => sleep('quality', v)}
                  />
                  <details className="notes-details">
                    <summary>
                      Sleep context <span>Optional</span>
                      <ChevronDown size={15} />
                    </summary>
                    <textarea
                      aria-label="Sleep notes"
                      value={entry.sleepNotes}
                      onChange={(e) => update('sleepNotes', e.target.value)}
                      maxLength={50000}
                      rows={3}
                    />
                  </details>
                </Panel>
                <Panel
                  id="body-signals"
                  title="03 · Body signals"
                  subtitle="Use the same device, method, and measurement routine where possible."
                >
                  <div className="section-icon">
                    <Waves size={20} />
                  </div>
                  <div className="fields-grid three">
                    <NumberField
                      label="HRV (ms)"
                      value={entry.physiology.hrv}
                      onChange={(v) => physiology('hrv', v)}
                      min={1}
                      max={500}
                      step={0.1}
                    />
                    <Field label="HRV method">
                      <select
                        value={entry.physiology.hrvMethod}
                        onChange={(e) =>
                          physiology(
                            'hrvMethod',
                            e.target.value as Entry['physiology']['hrvMethod'],
                          )
                        }
                      >
                        <option value="unknown">Unknown / not specified</option>
                        <option value="rmssd">rMSSD</option>
                        <option value="sdnn">SDNN</option>
                      </select>
                    </Field>
                    <Field label="Measurement source">
                      <select
                        value={entry.physiology.source}
                        onChange={(e) =>
                          physiology('source', e.target.value as Entry['physiology']['source'])
                        }
                      >
                        {['manual', 'garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].map(
                          (s) => (
                            <option key={s} value={s}>
                              {humanize(s)}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                    <NumberField
                      label="Resting heart rate (bpm)"
                      value={entry.physiology.restingHeartRate}
                      onChange={(v) => physiology('restingHeartRate', v)}
                      min={20}
                      max={250}
                    />
                    <NumberField
                      label="Respiratory rate (breaths/min)"
                      value={entry.physiology.respiratoryRate}
                      onChange={(v) => physiology('respiratoryRate', v)}
                      min={3}
                      max={60}
                      step={0.1}
                    />
                    <NumberField
                      label="Temperature (°C)"
                      value={entry.physiology.temperatureC}
                      onChange={(v) => physiology('temperatureC', v)}
                      min={30}
                      max={45}
                      step={0.1}
                    />
                    <NumberField
                      label="Body weight (kg)"
                      value={entry.physiology.weightKg}
                      onChange={(v) => physiology('weightKg', v)}
                      min={20}
                      max={400}
                      step={0.1}
                    />
                  </div>
                  <div className="divider" />
                  <Scale
                    {...scaleDefinitions.illnessSeverity}
                    value={entry.illnessSeverity}
                    onChange={(v) => update('illnessSeverity', v)}
                  />
                  <p className="field-label">
                    Specific symptoms <span className="muted">· select to rate severity</span>
                  </p>
                  <div className="symptom-options">
                    {symptomTypes.map((name) => (
                      <label
                        className={`choice-chip ${entry.symptoms.some((s) => s.name === name) ? 'selected' : ''}`}
                        key={name}
                      >
                        <input
                          type="checkbox"
                          checked={entry.symptoms.some((s) => s.name === name)}
                          onChange={(e) => {
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
                        low="Mild"
                        high="Severe"
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
                  <details className="notes-details">
                    <summary>
                      Symptom context <span>Optional</span>
                      <ChevronDown size={15} />
                    </summary>
                    <textarea
                      aria-label="Illness notes"
                      value={entry.illnessNotes}
                      onChange={(e) => update('illnessNotes', e.target.value)}
                      maxLength={50000}
                      rows={3}
                    />
                  </details>
                </Panel>
                <Panel
                  id="training"
                  title="04 · Movement & training"
                  subtitle="An explicit rest day is a useful observation, too."
                >
                  <div className="section-icon">
                    <Dumbbell size={20} />
                  </div>
                  <Field label="Training status">
                    <select
                      value={entry.trainingStatus}
                      onChange={(e) => {
                        if (entry.workouts.length && e.target.value !== 'trained') {
                          setError('Remove the workouts before marking a rest or unrecorded day.');
                          return;
                        }
                        update('trainingStatus', e.target.value as Entry['trainingStatus']);
                      }}
                    >
                      <option value="unrecorded">Not recorded</option>
                      <option value="rest">Rest day</option>
                      <option value="trained">Trained</option>
                    </select>
                  </Field>
                  {entry.workouts.map((w, index) => (
                    <div className="workout-editor" key={w.id}>
                      <div className="workout-heading">
                        <h3>Session {index + 1}</h3>
                        <button
                          type="button"
                          className="icon-button danger-text"
                          aria-label={`Remove session ${index + 1}`}
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
                        <Field label="Activity">
                          <select
                            value={w.type}
                            onChange={(e) =>
                              editWorkout(index, { type: e.target.value as Workout['type'] })
                            }
                          >
                            {workoutTypes.map((t) => (
                              <option key={t} value={t}>
                                {humanize(t)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Session title (optional)">
                          <input
                            value={w.title}
                            onChange={(e) => editWorkout(index, { title: e.target.value })}
                            maxLength={120}
                            placeholder="e.g. Easy run"
                          />
                        </Field>
                        <NumberField
                          label="Duration (minutes)"
                          value={w.durationMinutes || null}
                          onChange={(v) => editWorkout(index, { durationMinutes: v ?? 0 })}
                          min={1}
                          max={1440}
                        />
                        <NumberField
                          label="Distance (km)"
                          value={w.distanceKm}
                          onChange={(v) => editWorkout(index, { distanceKm: v })}
                          max={1000}
                          step={0.01}
                        />
                        <NumberField
                          label="Average heart rate (bpm)"
                          value={w.averageHeartRate}
                          onChange={(v) => editWorkout(index, { averageHeartRate: v })}
                          min={25}
                          max={250}
                        />
                      </div>
                      <div className="scales-grid">
                        <Scale
                          label="Perceived effort"
                          min={1}
                          low="Very easy"
                          high="Maximal"
                          value={w.effort}
                          onChange={(v) => editWorkout(index, { effort: v })}
                        />
                        <Scale
                          label="Pain during training"
                          low="None"
                          high="Extreme"
                          value={w.pain}
                          onChange={(v) => editWorkout(index, { pain: v })}
                        />
                      </div>
                      {w.type === 'strength' && (
                        <div className="strength-sets">
                          <p className="field-label">Exercises & sets</p>
                          {w.sets.map((set, si) => (
                            <div className="set-row" key={si}>
                              <Field label="Exercise">
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
                                aria-label={`Remove exercise ${si + 1}`}
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
                                sets: [...w.sets, { exercise: '', sets: 1, reps: 1, weightKg: 0 }],
                              })
                            }
                          >
                            Add exercise
                          </button>
                        </div>
                      )}
                      <details className="notes-details">
                        <summary>
                          Session notes <span>Optional</span>
                          <ChevronDown size={15} />
                        </summary>
                        <textarea
                          aria-label={`Session ${index + 1} notes`}
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
                    <Plus size={16} /> Add training session
                  </button>
                </Panel>
              </div>
              <aside className="checkin-aside">
                <div className="checkin-tips">
                  <span className="eyebrow">MAKE IT A RITUAL</span>
                  <h2>
                    Consistency
                    <br />
                    over perfection.
                  </h2>
                  <p>Check in at a similar time each day. Use the same meaning for your ratings.</p>
                  <div className="divider" />
                  <strong>Missing is okay.</strong>
                  <p>
                    Leave a field blank if you haven’t measured it. A zero means you actually
                    observed zero.
                  </p>
                  <strong>Numbers first. Words second.</strong>
                  <p>
                    Your ratings power the charts. Notes preserve the context you might want to
                    revisit.
                  </p>
                  <span className="timezone-label">Time zone: {entry.timezone}</span>
                </div>
              </aside>
            </div>
          </fieldset>
          <div className="save-bar">
            <div aria-live="polite">
              {saved ? (
                <span className="saved-state">
                  <Check size={16} />
                  {demo ? 'Saved in demo memory' : 'Saved to your journal'}
                </span>
              ) : (
                <span className="muted">
                  {dirty
                    ? 'You have unsaved changes'
                    : revision
                      ? `Existing entry · revision ${revision}`
                      : 'Your entry is not saved yet'}
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
                  <Trash2 size={16} /> Delete
                </button>
              )}
              <button className="button primary" type="submit" disabled={saving || loadFailed}>
                <Save size={16} />
                {saving ? 'Saving…' : 'Save check-in'}
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
              Retry loading this day
            </button>
          )}
        </form>
      )}
    </>
  );
}
