# Import and export

## Export formats and selection

Select a date range, data groups and individual fields. Groups include daily ratings, sleep, physiology, symptoms, workouts, context labels and optional narratives. Required metadata retains the date, timezone, schema version, revision and timestamps. JSON, NDJSON and Markdown also include an export dictionary. Notes are excluded unless selected, including nested workout notes.

| Format            | Structure                                         | Import support                       |
| ----------------- | ------------------------------------------------- | ------------------------------------ |
| JSON              | Metadata and `entries` array                      | Yes; preferred for preservation      |
| NDJSON / JSONL    | First `_meta` line, then one observation per line | Yes                                  |
| CSV               | Dotted columns; arrays as JSON; quoted strings    | Yes, with the limitations below      |
| Markdown          | Human-readable report with dictionary             | No; use JSON/NDJSON for a round trip |
| Analysis download | Model, pairs/design, settings and diagnostics     | No; this is not a journal export     |

Exports stream batches of 50 and accept up to 1,831 dates. Streaming-capable browsers save directly to disk; other browsers have a 64 MiB buffer cap. Counts and batches are not a transactional snapshot; avoid concurrent edits. A failed stream is an incomplete export, not a backup.

CSV formula-like strings are apostrophe-prefixed. Import preserves those apostrophes because an original leading apostrophe cannot always be distinguished from export protection. JSON and NDJSON preserve text more precisely. CSV dates use ISO `YYYY-MM-DD`, numbers use a decimal point without locale separators, blanks represent missing numbers, and nested arrays must contain JSON. Unknown/doubled headers, malformed quoting and invalid values are rejected.

## Reviewed import

The Import page accepts up to 500 days and 20 MiB per file. Files are parsed locally, validated, and presented as dates and supplied fields before a confirmation checkbox enables saving. Unsupported versions, duplicate dates, invalid fields, excessive values and unsafe nested keys are rejected. Empty/missing data is never converted to a numeric zero.

The destination is the signed-in account. Source owner IDs are rejected; source revisions/timestamps do not replace server provenance. Import uses a current-account guard and ordinary revision-checked writes. Switching accounts during the operation stops further writes.

Policies:

- **Skip existing days:** existing dates remain untouched; new dates are created.
- **Merge supplied fields:** only fields in the file replace corresponding existing values, including explicit nulls. Nested sleep/physiology fields merge individually. Omitted fields remain unchanged.

For a new day, omitted fields remain unknown or empty narrative context. A supplied workout list replaces the entire list; notes omitted from an imported workout are preserved only for matching existing workout IDs. New workouts without notes receive empty notes. When only a workout list supplies training status, a nonempty list implies trained; an empty list leaves status unrecorded. Cross-field consistency is checked again on the final merged entry.

Each day is saved separately. Concurrent edits produce conflicts instead of overwrites. Network or validation errors can leave a partially completed import; the result table lists every attempted date and its status. Retrying with Skip existing days preserves completed work. Browser navigation or closing the tab can interrupt the operation. Export current data before intentionally merging replacements.

Full database backups additionally preserve account identities and credential state. They are an infrastructure operation, not an application import; see [Deployment](DEPLOYMENT.md).

## Complete journal copy

**Select complete JSON backup** selects all seven data groups, every optional field, and JSON. It includes the journal's full recorded date range when that span fits the export limit; longer histories require separate ranges. A restorable file must also fit the import limits of 500 days and 20 MiB, so split larger histories before exporting. This copies observations, not account credentials.

The exporter uses the same verified-workspace identity guard as journal reads and writes. Where a browser exposes a file picker but denies access to it, export falls back to the bounded download path. Cancelling the picker cancels the export. Selection controls remain disabled until preparation ends; success is reported only after the stream completes or the download is prepared.
