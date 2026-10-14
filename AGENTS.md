# Repository instructions

Treat Tedd’mhen as a production application. The repository is public; deployed health records are private. All application copy, source comments, README content, and technical documentation must be in English.

- Keep subjective experiences numerically analyzable with explicit scales and anchors. Narrative fields are optional context, not a substitute for structured measurements.
- Preserve `null` for missing observations. Do not silently impute, coerce missing values to zero, or interpret an unrecorded training day as rest.
- Target the owner's Cloudflare account: Workers Static Assets, D1, and the AuthService SQLite Durable Object. Use application email/password sessions; Cloudflare Access is only for verified legacy-owner migration. Do not deploy to an unrelated hosting account.
- Scope every data operation to the verified owner. Never trust a client-supplied owner identifier. Keep production authentication fail-closed.
- Keep credentials, real records, exports, database state, and private screenshots out of commits and public CI artifacts. Use synthetic test records.
- Maintain the README, data dictionary, deployment guide, and model methodology as the implementation changes. Version incompatible schema/model changes and use append-only deployed migrations.
- Describe priors, uncertainty, missingness, and model limitations. Do not present exploratory associations as causal, clinical, or validated forecasting results.
- Run appropriate validation before delivery: formatting, TypeScript, unit/API tests, production build, and browser tests for affected flows. Investigate failures rather than suppressing them.
- Preserve a working migration and backup/restore path. Do not assume storage or runtime limits are unlimited.

See `CONTRIBUTING.md`, `SECURITY.md`, and `docs/` for the implementation contracts.
