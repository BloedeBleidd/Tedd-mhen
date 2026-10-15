import { habitFeatureLabel, habitMeasures, habitValue, type HabitSummary } from './habits';
import { metrics, type MetricKey } from './metrics';
import {
  dayNumber,
  scaleDefinitions,
  symptomTypes,
  workoutTypes,
  type EntrySummary,
} from './schema';
export const references = {
  intervalScore: {
    title:
      'Gneiting, T. & Raftery, A. E. (2007). Strictly Proper Scoring Rules, Prediction, and Estimation. JASA 102(477), 359–378.',
    url: 'https://doi.org/10.1198/016214506000001437',
  },
  circularBootstrap: {
    title:
      'Politis, D. N. & Romano, J. P. (1992). A Circular Block-Resampling Procedure for Stationary Data.',
    url: 'https://mathweb.ucsd.edu/~politis/DPpublication.html',
  },
  correlation: {
    title: 'SciPy: Pearson correlation',
    url: 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html',
  },
  ranks: {
    title: 'SciPy: Spearman rank correlation',
    url: 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html',
  },
  bootstrap: {
    title: 'R boot: time-series block bootstrap',
    url: 'https://stat.ethz.ch/R-manual/R-devel/library/boot/html/tsboot.html',
  },
  bayes: {
    title: 'Murphy, K. P. (2007). Conjugate Bayesian analysis of the Gaussian distribution.',
    url: 'https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf',
  },
  forecasting: {
    title: 'Hyndman & Athanasopoulos: regression and forecasting',
    url: 'https://otexts.com/fpp3/regression.html',
  },
  validation: {
    title: 'Hyndman & Athanasopoulos: temporal forecast evaluation',
    url: 'https://otexts.com/fpp3/toolbox.html',
  },
  load: {
    title: 'Foster et al. (2001): session-RPE training monitoring',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11708692/',
  },
  hrv: {
    title: 'Task Force (1996): HRV measurement standards',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8598068/',
  },
};
export type Feature = {
  id: string;
  label: string;
  unit: string;
  kind: 'numeric' | 'binary';
  group: string;
  description: string;
  reference?: keyof typeof references;
  get: (entry: EntrySummary) => number | null;
};
const descriptions: Partial<Record<MetricKey, string>> = {
  sleepHours:
    'Actual recorded sleep minutes / 60; independent of time in bed. Assigned to the waking date.',
  sleepLatency: 'Reported minutes needed to fall asleep. Missing is not zero.',
  awakenings: 'Recorded count of awakenings; device and self-report methods may differ.',
  sleepScore:
    'Vendor-defined 0–100 score, not a universal measure. Compare within a consistent device/source.',
  sleepQuality:
    'Project-defined 1–10 rating: very poor to excellent. Not a validated clinical questionnaire.',
  hrv: 'Recorded heart-rate variability in milliseconds. rMSSD and SDNN describe different statistics; filter to a consistent method and measurement source. The app does not calculate HRV from raw beats.',
  restingHeartRate:
    'Recorded resting heart rate in beats/minute. Posture, timing, device and measurement conditions can change comparability.',
  respiratoryRate: 'Recorded breaths per minute. No diagnostic threshold is inferred.',
  temperature:
    'Recorded body temperature in °C. Measurement site and method should stay consistent.',
  bodyWeight:
    'Recorded body mass in kg. Short-term changes are not necessarily changes in body composition.',
  trainingHours:
    'Sum of recorded session minutes / 60. Explicit rest is zero; unrecorded training is missing.',
  trainingLoad:
    'Sum of session duration in minutes × perceived effort. Arbitrary units, inspired by session-RPE research; the project-defined 1–10 effort scale is not an exact reproduction of a validated protocol. Missing any effort makes daily load unknown.',
  trainingEffort:
    'Sum(duration × effort) / sum(duration), across all recorded sessions. Undefined on rest/unrecorded days or when any effort is missing.',
  workoutCount:
    'Number of recorded sessions. Explicit rest is zero; unrecorded training is unknown.',
  symptomCount:
    'Number of symptoms listed. Unknown when both the list and illness rating are unrecorded. A zero count is not proof of health.',
  symptomBurden:
    'Sum of listed 1–10 symptom severities. A descriptive, project-defined total, not a validated illness score; symptoms can overlap.',
};
export function featureCatalog(entries: EntrySummary[] = []): Feature[] {
  const numeric: Feature[] = Object.entries(metrics).map(([id, spec]) => {
    const scale = scaleDefinitions[id as keyof typeof scaleDefinitions];
    const clock = /(?:bedtime|wakeTime)(?:Sin|Cos)$/.test(id);
    return {
      id,
      label: spec.label,
      unit: spec.unit,
      kind: 'numeric',
      group: clock
        ? 'Sleep timing'
        : scale
          ? 'Daily ratings'
          : id.startsWith('sleep') || id === 'awakenings'
            ? 'Sleep'
            : id.startsWith('training') || id === 'workoutCount'
              ? 'Training'
              : id.startsWith('symptom')
                ? 'Symptoms'
                : 'Body signals',
      description:
        descriptions[id as MetricKey] ||
        (scale
          ? `${scale.min}–10: ${scale.low} to ${scale.high}. Project-defined anchored self-report, not a validated clinical scale.`
          : 'Clock time encoded as sin(2π × minutes/1440) or cos(2π × minutes/1440). Select both components to represent a full daily cycle without a midnight discontinuity. Units are dimensionless, not hours.'),
      reference:
        id === 'trainingLoad' ? 'load' : id === 'hrv' ? 'hrv' : clock ? 'forecasting' : undefined,
      get: spec.get,
    };
  });
  const binary = (
    id: string,
    label: string,
    group: string,
    description: string,
    get: Feature['get'],
  ): Feature => ({
    id,
    label,
    group,
    description,
    unit: '0 / 1',
    kind: 'binary',
    get,
    reference: 'forecasting',
  });
  const result = [
    ...numeric,
    binary(
      'trained',
      'Training day',
      'Training labels',
      '1 = trained, 0 = explicit rest; unrecorded is missing.',
      (e) => (e.trainingStatus === 'unrecorded' ? null : Number(e.trainingStatus === 'trained')),
    ),
    ...workoutTypes.map((type) =>
      binary(
        `activity:${type}`,
        `Activity: ${type}`,
        'Training labels',
        '1 = activity recorded that day; 0 = not listed on a known training/rest day. Multiple activities can be present.',
        (e) => (e.trainingStatus === 'unrecorded' ? null : Number(e.workoutTypes.includes(type))),
      ),
    ),
    ...symptomTypes.map((type) =>
      binary(
        `symptom:${type}`,
        `Symptom: ${type.replaceAll('_', ' ')}`,
        'Symptom labels',
        '1 = symptom listed; 0 = not listed when symptom/illness information was recorded. Missing when both are unknown. Not a diagnosis.',
        (e) =>
          e.symptoms.length || e.illnessSeverity !== null
            ? Number(e.symptoms.some((s) => s.name === type))
            : null,
      ),
    ),
    ...['garmin', 'apple', 'oura', 'whoop', 'polar', 'other'].map((source) =>
      binary(
        `source:${source}`,
        `Source: ${source}`,
        'Measurement labels',
        'Indicator against manual-source reference. Accounts for a label, not a calibration between devices.',
        (e) => Number(e.physiology.source === source),
      ),
    ),
    ...['rmssd', 'sdnn'].map((method) =>
      binary(
        `method:${method}`,
        `HRV method: ${method}`,
        'Measurement labels',
        'Indicator against unknown-method reference. Including this indicator does not make HRV methods interchangeable.',
        (e) => Number(e.physiology.hrvMethod === method),
      ),
    ),
    ...['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) =>
      binary(
        `weekday:${i + 1}`,
        day,
        'Calendar',
        'Calendar-day indicator, with Monday as the reference. Derived from the journal date, not the current browser timezone.',
        (e) => Number((new Date(dayNumber(e.date) * 86400000).getUTCDay() + 6) % 7 === i + 1),
      ),
    ),
    ...[...new Set(entries.flatMap((e) => e.labels || []))]
      .sort()
      .map((label) =>
        binary(
          `label:${label}`,
          `Context: ${label}`,
          'Your labels',
          '1 = this label listed; 0 = explicitly recorded context without this label; missing = context not recorded. User-defined context, not verified exposure.',
          (e) => (e.labels == null ? null : Number(e.labels.includes(label))),
        ),
      ),
  ];
  const recorded = new Map<string, HabitSummary>();
  const durationKeys = new Set<string>(),
    timedKeys = new Set<string>();
  for (const entry of entries.slice().sort((a, b) => a.date.localeCompare(b.date)))
    for (const habit of entry.habits || []) {
      recorded.set(habit.key, habit);
      if (habit.durationMinutes !== null) durationKeys.add(habit.key);
      if (habit.count && habit.times.length === habit.count) timedKeys.add(habit.key);
    }
  const habits: Feature[] = [...recorded.values()].flatMap((habit) =>
    habitMeasures
      .filter(
        (measure) =>
          measure === 'count' || (measure === 'duration' ? durationKeys : timedKeys).has(habit.key),
      )
      .map((measure) => ({
        id: `habit:${habit.key}:${measure}`,
        label: habitFeatureLabel(habit, measure),
        unit: measure === 'count' ? 'count' : measure === 'duration' ? 'min' : 'cyclic',
        kind: 'numeric',
        group: 'Habits & activities',
        description:
          measure === 'count'
            ? 'Daily count for this recorded habit. Missing is unknown; an explicit zero means none.'
            : measure === 'duration'
              ? 'Total recorded minutes for this habit. Missing duration is not zero.'
              : 'Mean sine/cosine of local event times; available only when every counted event has a time. Select both components. Not elapsed hours.',
        get: (entry: EntrySummary) =>
          habitValue(
            entry.habits?.find((h) => h.key === habit.key),
            measure,
          ),
      })),
  );
  return [...habits, ...result];
}
export function featureSeries(entries: EntrySummary[], feature: Feature, window = 1) {
  const raw = new Map(entries.map((e) => [dayNumber(e.date), feature.get(e)]));
  if (window === 1 || feature.kind === 'binary') return raw;
  return new Map(
    entries.map((e) => {
      const day = dayNumber(e.date);
      let sum = 0;
      for (let offset = 0; offset < window; offset++) {
        const value = raw.get(day - offset);
        if (value == null) return [day, null] as const;
        sum += value;
      }
      return [day, sum / window] as const;
    }),
  );
}
