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

Bedtime is generally the preceding evening; daytime sleep is permitted. These clock fields do not record separate dates, UTC offsets or multiple sleep episodes. Duration is explicitly entered, never derived from them. Use notes for exceptional context. The physiology source field also describes the device sleep score source in this initial schema; split sources across sleep and physiology require a future schema extension.

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

## Narrative and provenance

`notes`, `sleepNotes`, and `illnessNotes` each allow up to 50,000 characters. The complete daily JSON write body must fit within 256 KiB. Narratives can contain arbitrary Unicode, are preserved as written, and are not modeled statistically.

`schemaVersion=1` identifies field semantics. `revision` starts at 1 and increases on successful edits. `createdAt` and `updatedAt` use UTC timestamps. These fields support reproducibility and conflict detection; this version does not retain previous record revisions as an audit history.

Export field selection never removes required provenance. Including HRV without method/source may make it uninterpretable; retain those context fields. Excluding the written-context group also removes nested workout notes. JSON and NDJSON preserve nulls and nested data; CSV requires separate dictionary context.
