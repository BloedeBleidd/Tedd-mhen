# Algorithm verification

Every algorithmic change requires meaningful automated tests. Tests use synthetic data and independently check intended behavior, not merely mirror implementation lines. Run formatting, TypeScript, unit/API tests, a production build and affected browser flows before deployment. CI runs these checks and a dependency audit.

| Area                     | Required evidence                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bayesian trend           | Hand-derived posterior and Student-t quantile; gaps, constants, shrinkage, bounds, duplicate dates                                                                                                                     |
| Multivariable regression | Orthogonal-design reference posterior; proper-prior behavior under collinearity; coefficient units; credible vs predictive widths                                                                                      |
| Forecast evaluation      | Synthetic known generating relation; strict chronological embargo; unchanged earlier predictions when held-out outcomes change; matched baseline rows                                                                  |
| Correlations             | Pearson/rank references, tied ranks, constants, nonfinite values, calendar lags, first differences and linear detrending                                                                                               |
| Bootstrap                | Reproducible seed, known perfect-correlation interval, insufficient blocks/pairs and degenerate replicates                                                                                                             |
| Feature transforms       | Complete rolling windows, missing calendar dates, categorical unknown/zero distinctions, cyclic clock encoding                                                                                                         |
| Import/export            | Full-format round trips, selective merge, notes preservation, Unicode/CSV quoting, duplicate dates, invalid schemas, unknown keys, formula mitigation                                                                  |
| API and administration   | Real SQLite queries, owner isolation, revision conflicts, body/selection bounds, account-switch guard, explicit admin grants and denied forged roles                                                                   |
| Accounts                 | Hash verification, session expiry/versioning, concurrent one-use recovery, legacy-ID migration, throttling and account deletion                                                                                        |
| Motion                   | Viewport-triggered reveals, delayed SVG layers, cleanup, fixed chart geometry, live reduced-motion cancellation and missing browser APIs                                                                               |
| Appearance               | Sunrise/sunset boundaries, polar conditions, system/manual fallback, denied permission/storage                                                                                                                         |
| Demo workspace           | Reproducible schema-valid fixture and SQL seed; immutable baseline; fixed-owner authenticated reads; leap-day projection; null/rest distinctions; isolated CRUD/import/export; cancellation, retry and mobile switcher |
| Release packaging        | Strict file boundary, symlink rejection, reference SHA-256 digests, version/tag consistency, preserved production bindings and extracted-archive browser tests                                                         |

Vitest runs the mathematical and SQLite-backed API suites. Playwright runs the compiled application against local Wrangler/D1 and the actual AuthService Durable Object, including a strict authentication server. It covers registration/recovery, journal CRUD, selective export/import, labels, analysis Web Workers, model downloads, themes, mobile layout and public author information.

CI builds a clean committed checkout and runs the browser suite against the extracted Cloudflare release archive with `npm run release:test`. Source development uses `npm run test:e2e`. Both modes use the same browser assertions and isolated synthetic stores. See [Releases](RELEASES.md) for package contents, provenance and publication gates.

Browser fixtures use isolated `.wrangler/e2e*` directories that are reset at startup. Real development or production databases are not test fixtures. Screenshots/traces are ignored and are not uploaded to public CI. Production verification uses short-lived synthetic accounts and removes their data afterward.

Tests demonstrate implementation properties, not clinical validity. Synthetic prediction accuracy does not establish real-user accuracy. Changes to model semantics require a model-version change and updated mathematical documentation; deployed SQL migrations are append-only.
