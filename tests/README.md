# Test boundaries

- `schema.test.ts`: missingness, explicit rest, rating bounds, dates, and symptom consistency.
- `bayes.test.ts`: hand-derived reference posterior and Student-t quantile, elapsed-time treatment, prior sensitivity, intervals, and boundary behavior.
- `export.test.ts`: exact field selection, narrative exclusion, nested serialization, CSV escaping and formula mitigation.
- `auth.test.ts`: fail-closed defaults, signed JWT verification, audience/issuer/expiry enforcement, signature tampering, local-mode restrictions.
- `deployment.test.ts`: JSONC configuration parsing and deployment guards for database, origin, AuthService, local bypass, and alternate endpoints.
- `accounts.test.ts`: SQLite-backed credential transactions, legacy identity reservation/claim, concurrent recovery and replay, credential rotation, expiry and owner-only deletion.
- `passwords.test.ts`: salted password hashes, password verification, recovery entropy format and session cookie attributes.
- `appearance.test.ts`: sunrise/sunset boundaries, manual/system fallback, polar day/night, timezone-independent instants and invalid preferences.
- `api.test.ts`: production API handlers against an in-memory SQLite adapter, including real SQL, owner isolation, stale revisions, body limits, search, pagination, and export formats. Identity is mocked here; cryptography is tested separately.
- `browser/journal.spec.ts`: compiled UI against a real local Wrangler Worker and D1 database, daily entry persistence/edit/delete, exports, demo analysis, mobile navigation, and unsaved-change protection.

- `browser/accounts.spec.ts`: strict real Worker/Durable Object/D1 registration, login, recovery, account isolation, deletion, spoof/CSRF rejection and persistent attempt throttling; signup UI keeps the recovery code until acknowledgement.
- `browser/appearance.spec.ts`: opt-in geolocation, exact sunset switch without reload, manual mode persistence, denied permission/storage, privacy notice and mobile layout.

Browser tests use port 8788 and `.wrangler/e2e` for the explicit local bypass; strict accounts use port 8789 and `.wrangler/e2e-accounts`. These isolated synthetic stores are reset at test-server startup, separately from development/production data. All records are synthetic. Screenshots and traces are ignored and are not uploaded by public CI. Tests do not establish clinical validity or replace production migration/login checks.
