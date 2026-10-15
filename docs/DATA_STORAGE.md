# Collection, storage and retention

## Collection contract

Daily check-ins record explicit numeric scales, sleep, physiology, symptoms and training sessions. Notes are optional. Missing values stay `null`; explicit rest and zero symptom severity have different meanings from unknown values. Context labels distinguish unrecorded (`null`) from explicitly no labels (`[]`). Sleep belongs to the date of waking. Field semantics and limits are defined in the [data dictionary](DATA_DICTIONARY.md).

Each saved day has an owner ID, journal date, timezone, schema version, optimistic revision, and creation/update timestamps. One owner/date pair identifies a record. An update or deletion must match the current revision. Old revisions are not retained as an application audit history.

## Persistence and access

The owner’s Cloudflare account hosts the Worker, static application, D1 SQLite database and authentication Durable Object. Public source and static assets contain no personal journal records. The repository includes only synthetic example records for seeding the shared demo. Personal data APIs derive the owner from a verified application session, never from imported metadata or browser-supplied ownership.

D1 stores journal JSON, account identifiers, salted password hashes, recovery-code hashes and session-token hashes. The authentication Durable Object stores expiring attempt counters keyed by hashed IP/email identifiers. Email is an unverified sign-in identifier. No mail service is connected. See [Security](https://github.com/BloedeBleidd/Tedd-mhen/blob/main/SECURITY.md) for authentication, session lifetime and local-only bypass rules.

The database was provisioned in EEUR; this does not establish that all Cloudflare processing is confined to that region. Authorized infrastructure administrators can access data. Storage is not end-to-end encrypted. The application adds no analytics trackers, advertising SDKs, third-party fonts, or LLM integration.

## Analysis and browser state

List/analysis payloads omit long narratives and workout details. Statistical calculations run in the browser; multivariable and correlation work runs in a Web Worker to keep the interface responsive. No observation is sent to an external statistics or AI service. All-history analysis accepts at most 10,000 recorded days and reports an error above that size; it never silently samples or truncates a journal.

Appearance and optional approximate coordinates live in browser local storage. Geolocation is requested only after an explicit button action. Coordinates are rounded to two decimal places and are not sent to the application API or D1. Sunrise/sunset are calculated locally. Browser/OS location providers operate separately. The necessary-cookie notice acknowledgement is another local preference.

Journal imports are parsed and previewed in the browser before confirmation. Confirmed imports use ordinary authenticated, revision-checked writes into the current account. Exports and model reports are downloaded to user-controlled files. See [Import and export](IMPORT_EXPORT.md).

The [demo workspace](DEMO.md) loads a shared D1 baseline through a dedicated authenticated endpoint. A technical user owns these synthetic records and cannot sign in. Demo check-ins and imports change a browser-memory copy only; switching back or reloading discards it. There is no local-storage persistence of demo observations. Downloaded demo files remain until the user deletes them.

## Retention and deletion

Entries remain until deleted by their owner. Account deletion removes active entries, account credentials and sessions; administrative grants are removed with the user row. Sign-out deletes the current session; recovery/password changes invalidate previous sessions through the account version. Expired session rows are cleaned when sessions are created. Expired authentication-limiter keys are removed on subsequent authentication requests.

D1 Time Travel and private operational backups can retain deleted records for their respective retention periods. Manual migration backups are retained for at most 30 days unless a documented incident requires longer. They contain sensitive data and credential hashes; no automated backup scheduler is installed. Restoration must reconcile deletions and invalidate restored sessions before reopening service. Procedures and provider recovery windows are in [Deployment](DEPLOYMENT.md).

Deleting application data does not delete downloaded exports, browser-independent copies or files uploaded to an external LLM. Public issues, commits, CI artifacts and screenshots must contain synthetic data only.
