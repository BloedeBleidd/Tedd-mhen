# Data dictionary · schema version 1

All optional numerical values use `null` when unrecorded. Zero is an observation. Empty text is optional context, not evidence of absence. No metric is inferred from free text.

## Daily fields

| Field                 | Unit / range        | Interpretation                                                                  |
| --------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `date`                | `YYYY-MM-DD`        | Local journal day; sleep belongs to waking day                                  |
| `timezone`            | IANA zone           | Measurement clock-time context, captured when entry is created                  |
| `wellbeing`           | integer 1–10        | Very poor → excellent                                                           |
| `energy`              | integer 1–10        | Depleted → full of energy                                                       |
| `motivation`          | integer 1–10        | None → very high                                                                |
| `fatigue`             | integer 0–10        | None → extreme                                                                  |
| `stress`              | integer 0–10        | None → extreme                                                                  |
| `soreness`            | integer 0–10        | None → extreme                                                                  |
| `illnessSeverity`     | integer 0–10        | No illness → severe                                                             |
| `symptoms[].name`     | controlled category | Headache, sore throat, cough, congestion, feverish, digestive, dizziness, other |
| `symptoms[].severity` | integer 1–10        | Mild → severe                                                                   |

These rating anchors are **project-defined**, not standardized clinical instruments. The input bounds are validation limits, not medical reference ranges. A report of feeling feverish is distinct from measured temperature.

## Sleep

| Field (under `sleep`) | Unit / range                            |
| --------------------- | --------------------------------------- |
| `durationMinutes`     | integer 0–1,440; actual total sleep     |
| `bedtime`, `wakeTime` | local `HH:mm` clock time, or null       |
| `latencyMinutes`      | integer 0–720; time to fall asleep      |
| `awakenings`          | integer 0–100                           |
| `score`               | integer 0–100; wearable/source-specific |
| `quality`             | integer 1–10; very poor → excellent     |

Bedtime is generally the preceding evening; daytime sleep is permitted. These clock fields do not record separate dates, UTC offsets or multiple sleep episodes. Duration is explicitly entered, never derived from them. Use notes for exceptional context. The physiology source field also describes the device sleep score source. Separate sleep and physiology device sources are not stored.

## Physiology

| Field (under `physiology`) | Unit / range                                     |
| -------------------------- | ------------------------------------------------ |
| `hrv`                      | 1–500 ms                                         |
| `hrvMethod`                | `rmssd`, `sdnn`, `unknown`                       |
| `restingHeartRate`         | integer 20–250 bpm                               |
| `respiratoryRate`          | 3–60 breaths/min                                 |
| `temperatureC`             | 30–45 °C                                         |
| `weightKg`                 | 20–400 kg                                        |
| `source`                   | manual, Garmin, Apple, Oura, Whoop, Polar, other |

HRV methods, recording duration, posture and devices affect comparability. Record the same routine and filter to a consistent method/source for analysis. These bounds accommodate data entry; they do not define safe or healthy values.

## Training

`trainingStatus` is `unrecorded`, `rest`, or `trained`. A trained day requires at least one workout; rest and unrecorded days cannot contain workouts.

| Field (under each `workouts[]` item) | Unit / range                                                     |
| ------------------------------------ | ---------------------------------------------------------------- |
| `id`                                 | UUID                                                             |
| `type`                               | running, strength, cycling, swimming, walking, mobility, other   |
| `title`                              | optional string, up to 120 characters                            |
| `durationMinutes`                    | positive minutes, up to 1,440                                    |
| `distanceKm`                         | 0–1,000 km, or null                                              |
| `effort`                             | integer 1–10, very easy → maximal, or null                       |
| `pain`                               | integer 0–10, none → extreme, or null                            |
| `averageHeartRate`                   | integer 25–250 bpm, or null                                      |
| `sets[]`                             | exercise name, number of sets, repetitions per set, weight in kg |
| `notes`                              | optional narrative, up to 50,000 characters                      |

Derived training time sums duration only for explicitly recorded training/rest days. Derived daily load is `Σ(durationMinutes × effort)` in arbitrary units. Missing effort in any session makes the daily load unknown. Rest is zero. This is a descriptive project heuristic, not a validated readiness score or cross-sport equivalence.

## Context labels and analytical features

`labels` is null when context was not recorded, an empty array when explicitly no labels apply, or up to 12 distinct normalized lowercase strings of 1–40 characters. Labels such as `travel` or `late meal` are user-defined observations, not inferred from notes. Older version-1 records without this additive field are treated as null.

The analytical catalog contains numeric fields plus binary indicators for trained/rest status, activity types, symptoms, device source, HRV method, weekdays and observed custom labels. Monday, manual source and unknown HRV method are reference categories. Unknown training and label context remain null. A symptom absent from an otherwise recorded symptom/illness observation is zero; an unrecorded illness observation is unknown.

Additional numeric summaries are workout count, duration-weighted session effort, symptom count and summed symptom severity. The symptom sum is descriptive and is not a clinical severity instrument. Bedtime and wake time use paired sine/cosine coordinates, `sin(2π minutes/1440)` and `cos(2π minutes/1440)`, so times near midnight remain close. They cannot establish elapsed sleep duration or encode daylight-saving offsets. Exercise names and arbitrary narrative text are not model predictors.

See [Methodology](METHODOLOGY.md) for alignment, rolling windows and statistical treatment. The in-app Definitions & methods page lists each supported feature and its units, missingness rules and references.

## Narrative and provenance

`notes`, `sleepNotes`, and `illnessNotes` each allow up to 50,000 characters. The complete daily JSON write body must fit within 256 KiB. Narratives can contain arbitrary Unicode, are preserved as written, and are not modeled statistically.

`schemaVersion=1` identifies field semantics. `revision` starts at 1 and increases on successful edits. `createdAt` and `updatedAt` use UTC timestamps. These fields support reproducibility and conflict detection; this version does not retain previous record revisions as an audit history.

Export field selection never removes required provenance. Including HRV without method/source may make it uninterpretable; retain those context fields. Excluding the written-context group also removes nested workout notes. JSON and NDJSON preserve nulls and nested data; CSV requires separate dictionary context.

## Account and local preference data

Account data is separate from the journal export schema. `auth_accounts` contains the internal user ID, normalized unverified email identifier, salted versioned password hash, recovery-code digest, credential version and creation timestamp. `auth_sessions` contains the session-token digest, user ID, credential version and expiry timestamp. Raw passwords, session tokens and recovery codes are not stored in D1. Legacy migration reservations associate existing emails with their prior owner IDs; they are removed when claimed.

`administrators` stores an explicit internal user ID and grant timestamp; account deletion cascades to this role. Administration exposes aggregate counts and JSON byte volume, not user identities or journal bodies.

`demo_datasets` identifies the versioned synthetic journal, technical owner, title, fixed anchor date and expected record count. Demo entries use the same schema and scales as personal records. Their dates and timestamps shift together in the browser; their values are constructed examples, not measurements. See [Demo workspace](DEMO.md).

The AuthService Durable Object stores hashed IP/email limiter keys, attempt counts and expiry instants for ten-minute windows. Expired keys are removed on later authentication requests. These are operational abuse controls and are never part of journal exports.

Appearance mode and optional approximate device coordinates (two decimal places, with a capture timestamp) are browser-local preferences, not health observations. The notice acknowledgement is also browser-local. Neither enters D1, analysis, or exports. See the application's Privacy & data page for cookie lifetimes and retention.
