# Personal check-in layouts and routines

## Account and demo scope

The check-in customization control selects visible fields for subsequent visits and dates. Authenticated `GET /api/preferences` loads settings; changes save immediately through `PATCH /api/preferences`. Daily measurements require **Save check-in**. Settings belong to the verified account, not an email string submitted by the browser. No setting carries over into another account. A demo workspace uses the same API contract in memory and discards settings on reload or exit.

`user_preferences` stores `(owner_id, key, payload, uses, last_used)`. Canonical field paths, activity keys and choice-list identifiers stay language-independent. Custom activity names and context labels retain their original text. One row per setting supports independent concurrent changes; the last committed update wins for the same field. Selection-use counts are convenience metadata rather than behavioral observations. They count successful selection requests (including a retry if the earlier response was lost), not days the behavior occurred. Last-use timestamps are server-generated and monotonic per choice.

Updates are queued in order in the browser. Pending choices remain visible, failures show a retry action, and closing the tab while changes are pending prompts the user. Initial-load failure does not substitute a default layout and overwrite personal choices. Changes made in another open tab are loaded on the next full page reload; this is not live collaboration.

## Fields and recorded values

Fields are visible by default for accounts without preferences. The layout control can hide or restore individual ratings, sleep values, recovery measurements, symptoms, notes, context labels and the training section. When first saving a new day, ratings with no explicit layout preference adopt their recorded/unrecorded selection for future days. An explicit visible preference keeps the field available even when today’s value is missing. Unchecking an enabled rating clears that draft observation and hides its empty field for future days. Hiding through the layout control only changes presentation, never observations.

A recorded value overrides a hidden preference while editing that date, including zero, explicit rest and explicitly empty context labels. This prevents accidentally concealing or deleting measurements. Hidden fields become editable again through the same customization control. Sleep and physiological recovery measurements share a section; the canonical JSON groups remain separate for compatibility.

## Recurring habits and custom activities

Adding a preset or custom activity enables its **Include on new days, with blank values** checkbox while fewer than 100 routine identities are selected. At capacity, the daily row can still be added within the daily limit, but the interface explains that another routine must be deselected to enable repetition. Custom creation saves the definition immediately. A new, unrecorded day gets the selected identities with `count: null`, `durationMinutes: null`, `times: []` and `notes: ''`. Existing saved days are loaded as recorded and are not backfilled. Archiving a definition excludes it from new templates but retains historical observations.

Removing a daily row also disables its routine membership. To retain today's measurement while stopping future repetition, uncheck the routine checkbox without removing the row. The daily record supports up to 100 activities; routine construction uses the first 100 eligible identities in usage order. Restore or add another activity through its section when required. Templates do not copy daily ratings, training/rest status, notes, counts, durations or event times.

The last chosen measurement source and HRV method are reused as metadata on new days. Users must update them when devices or methods change. No physiological value is inferred from those defaults.

## Choice ordering and sport profiles

Reusable semantic choices use descending last-use time, then descending request count for tied timestamps, then their existing order. This includes activities, habits, symptoms, sources, HRV methods, training status, context labels and analysis metric/input selectors. A sport selector shows up to eight recent choices first, then the remaining sports in their registry categories. Context-label suggestions preserve original user text. Numeric ranges, horizons, date controls and ordered scales retain their natural order.

Sport field profiles are explicit in `shared/activities.ts`. Distance is offered for locomotion and distance-oriented activities; resistance activities offer exercises, sets, repetitions and weight. Duration, effort, pain and average heart rate are common measures. Changing the sport never erases an existing distance or set: nonempty fields remain visible for review. Profiles describe useful input fields, not validated sport-specific measurement protocols.

## Data lifecycle

Preferences are excluded from journal exports, imports and statistical design matrices: they are interface settings, not observations. Imported custom activity definitions remain available in the library, but import does not silently opt them into a daily routine. Account deletion cascades to active preferences. Database recovery and private backup retention also apply to settings; see [Data storage](DATA_STORAGE.md) and [Deployment](DEPLOYMENT.md).
