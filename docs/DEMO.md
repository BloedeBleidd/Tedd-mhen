# Demo workspace

## User experience

**Try demo** on the public home, sign-in and registration pages opens `/demo` without an account. Overview, daily check-in, journal filters, trend prediction, relationships, multivariable models, definitions, import and export operate on the examples. Help, privacy and author pages remain available. Internal links and direct URLs stay under `/demo/*`. A banner above the content offers **Sign in** and **Create account**; there is no floating workspace switcher. Signed-in users see only their private journal, and opening a demo URL while signed in redirects to `/`. Account management and administration are unavailable in the demo.

The shared example journal contains 236 observations over 240 calendar days. It includes running, strength sets, cycling, swimming, walking, mobility, rest, unrecorded training, incomplete measurements, symptoms and context labels. Synthetic stress, sleep, recovery and training patterns make charts and uncertainty visible without needing months of personal observations. These constructed relationships are interface examples, not health evidence or validation of forecasting accuracy.

The browser shifts dates and creation/update timestamps by the same whole-day offset so the final example is dated today. Relative gaps, values, measurement methods and workout identifiers remain intact. The offset is fixed when entering demo mode; no generated observation is presented as the user's own measurement.

## Storage and access boundary

Migration `0004_demo_journal.sql` stores the examples in `entries` under `system-demo-v1`. This technical `users` row has no password, recovery code or session. `demo_datasets` identifies `training-recovery-v1`, its owner, title, anchor date and expected record count. SQLite triggers reject inserting, changing, moving or deleting its entries and reject attaching an `auth_accounts` row to a demo owner.

`GET /api/demo` is public and read-only. The server selects the fixed synthetic dataset and owner, accepts no query parameters and returns at most 500 complete records with dataset metadata. The response contains no viewer identity or private records. Missing or inconsistent metadata fails explicitly. Responses are private and not cached. This endpoint is the sole public journal-data exception: ordinary entry, series, export and account endpoints remain scoped to the verified personal owner. Client-supplied owner fields cannot redirect any query.

The deterministic fixture source is `scripts/demo-fixture.mjs`; tests compare its generated SQL byte-for-byte with the migration and validate every record against the application schema. A future dataset change requires a new migration and versioned fixture; do not rewrite an applied migration. Seed generation is an offline release-maintenance operation, not a request-time dependency.

## Temporary experiments

Entering demo mode downloads a fresh baseline into a validated, independently cloned browser-memory workspace. Check-in edits, revision-checked deletes and reviewed imports operate on that copy, with no write requests to the personal API. Sequential imports see earlier writes immediately. Other users and browser tabs retain their own copies; the shared D1 baseline never changes.

Navigating between demo pages preserves the memory workspace. Leaving `/demo/*` or reloading discards all temporary edits. Nothing is stored in cookies, local storage or a personal journal. Unsaved check-ins request confirmation before navigation, including links to registration and sign-in. Import previews and form selections do not carry over into the private application. The demo route checks for an existing session before loading its baseline, and mounts the data provider only after snapshot validation. Loading failures allow retry or exit to account access; an obsolete response cannot reopen an abandoned demo. Demo requests are handled exclusively in memory and never fall back to private endpoints.

Demo exports use a `teddmhen-demo-` filename. JSON, NDJSON and Markdown identify the content as synthetic; CSV uses the filename because the data format has no metadata envelope. Downloaded analysis reports also carry a `synthetic` flag. Downloaded files survive leaving the workspace. Manually importing a demo export into a private journal is an explicit normal import and will create personal entries after review; there is no automatic copy-to-personal operation.

## Operations

The baseline occupies one D1 dataset rather than one copy per account. Each activation reads it once; local edits and analyses do not write back. Cloudflare storage, reads and request quotas still apply. Administrator reports show demo entry count and JSON bytes separately from personal journal totals and registered account counts. Database backups include the baseline and its guards. Follow [Deployment](DEPLOYMENT.md) for private backup and separate-database restore procedures.

## Synthetic habits

Migration 0006 adds reproducible preset and custom habit observations from `scripts/habits-fixture.mjs` without changing original training/sleep values or the 236-day count. It includes missing days, explicit zeros, partial event times, reading, caffeine, daylight, cold showers, nail biting and a custom Phone-free dinner category. Its apparent relationships are constructed, not evidence about real people. The migration preserves all baseline guards. Demo library and daily changes use browser memory only, and never write the shared D1 records.
