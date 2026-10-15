# Habits and custom activities

## Recording

Daily check-in → **Habits & activities** records behaviors independently of training sessions. Forty localized presets cover reading, screen routines, daylight, cold showers, sauna, relaxation, social activities, substance use, sexual activity and repetitive behaviors. Their presence is a recording option, not a recommendation or a claim of longevity benefit.

Users can create a named category in their private library and reuse it on other dates. Define one event consistently: for example, one cigarette, one nail-biting episode, or one reading session. Each daily category records a count, optional local event times, optional total minutes, and original notes. A blank count/duration means unknown; an explicit zero means none. An absent category is unrecorded, never an inferred zero. Overlapping behaviors are allowed; total minutes across different categories are not added into training load.

Times belong to the entry's calendar date and timezone, including events after midnight. They describe clock times, not UTC instants or daylight-saving offsets. A user can record only some remembered times: the count must be at least the number of times if known. Repeated times are allowed. Deleting an event time does not reduce the daily total; removing a category from a day makes that day's observation unknown.

## Identity and privacy

Preset keys are stable English identifiers (`preset:reading_before_bed`); their stored name is null and the interface supplies its localized label. Custom keys are `custom:<UUID>`. The library and daily records retain the original custom name. Language changes do not translate names or notes. Categories with the same display name but different keys remain distinct; the creation form reuses an existing matching library name to avoid accidental duplicates. Imported identities are never merged solely by name.

`habit_definitions` has a composite `(owner_id, key)` primary key. Every read/write derives its owner from the verified session. Creating a definition saves it immediately; daily observations are saved with the check-in. Archiving hides a category from new selections while retaining observations and model inputs. Account deletion removes the library and observations from the active database; backup retention still applies. Custom definitions have no separate sharing endpoint.

A daily record carries its custom name so a selective export is self-contained. Importing a successfully saved record remembers unknown custom keys in the destination library; failed or stale revisions cannot create definitions. A later library name does not silently rewrite historical records. Analysis uses the most recent observed name for a key in the selected data. See [Data lifecycle](DATA_STORAGE.md).

## Analysis

Recorded categories appear in the **Choose inputs** controls on Relationships and Multivariable predictions. Count is a numeric feature; duration is available when recorded. Missing days are not filled. Habit features can be compared against the standard outcomes, such as sleep, wellbeing or HRV. Custom counts are not themselves forecast outcomes, and no Poisson/count forecast model is fitted.

When a positive daily count equals the number of recorded event times, the time features are:

```text
angle_i = 2π × local_minutes_i / 1440
sine = mean(sin(angle_i))
cosine = mean(cos(angle_i))
```

Choose both components. This representation avoids a discontinuity between 23:59 and 00:01. These are dimensionless mean coordinates, not mean clock hours; opposite event times can cancel. Partial times, unknown counts and zero-event days have no time features. Numeric rolling means require complete calendar windows, as for other inputs. Larger counts and many categories can increase model dimensionality and missingness; existing feature and complete-case limits still apply.

An evening behavior belongs to its calendar date, while sleep belongs to the waking date. A one-day predictor lag relates an evening to the following night's sleep. Same-date comparisons remain available but must not be interpreted as temporal causation. Context labels, category presence, counts and durations can overlap; avoid duplicate predictors. Notes are not analyzed. See [Methodology](METHODOLOGY.md).

## Portability and bounds

The `habits` export group includes keys, original custom names, counts, local times and duration. The optional `habitNotes` field also requires the `habits` group/field. Omitting notes excludes them from every item. JSON/NDJSON/CSV imports support the same structure. A supplied array replaces that day's array; omitted notes are preserved by key when merging into an existing day. An omitted array preserves the existing observations. Empty arrays explicitly remove them.

The schema allows 100 categories/day, 500 times/category/day, count 0–100,000, total duration 0–1,440 minutes, names up to 120 characters and notes up to 50,000 characters. The whole write still must fit 256 KiB. The library listing rejects more than 10,000 definitions instead of silently truncating. These are engineering bounds, not plausible or healthy behavioral limits.

The public demo includes synthetic examples, a custom category and missing/zero observations. Its library changes and check-ins remain in browser memory and disappear on reload. See [Demo workspace](DEMO.md).

## Reusable daily routines

Check-in separates preset habits from **My custom activities**. Adding a category remembers its identity immediately in account preferences and creates blank fields on new, unrecorded days. Measurements, notes and times are not carried forward. The routine checkbox can stop future repetition while keeping today's observation. Removing the daily row also disables repetition; archiving a custom definition retains historical records but excludes it from new templates. See [Personalization](PERSONALIZATION.md).
