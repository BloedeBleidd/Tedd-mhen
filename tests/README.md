# Test boundaries

- `schema.test.ts`: missingness, explicit rest, rating bounds, dates, and symptom consistency.
- `bayes.test.ts`: hand-derived reference posterior and Student-t quantile, elapsed-time treatment, prior sensitivity, intervals, and boundary behavior.
- `export.test.ts`: exact field selection, narrative exclusion, nested serialization, CSV escaping and formula mitigation.
- `auth.test.ts`: fail-closed defaults, signed JWT verification, audience/issuer/expiry enforcement, signature tampering, local-mode restrictions.
- `api.test.ts`: production API handlers against an in-memory SQLite adapter, including real SQL, owner isolation, stale revisions, body limits, search, pagination, and export formats. Identity is mocked here; cryptography is tested separately.
- `browser/journal.spec.ts`: compiled UI against a real local Wrangler Worker and D1 database, daily entry persistence/edit/delete, exports, demo analysis, mobile navigation, and unsaved-change protection.

Browser tests use port 8788 and `.wrangler/e2e`, separate from the development database. All records are synthetic. Screenshots and traces are ignored and are not uploaded by the public CI workflow.
