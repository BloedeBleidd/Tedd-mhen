# Tedd’mhen

A personal training, sleep and wellbeing journal with structured measurements, exploratory correlations, Bayesian predictions, and portable data.

**[Open Tedd’mhen](https://teddmhen.piotrzmudadev.com)** · [Try demo](https://teddmhen.piotrzmudadev.com/demo) · [Documentation](https://bloedeBleidd.github.io/Tedd-mhen/) · [Releases](https://github.com/BloedeBleidd/Tedd-mhen/releases) · by [Piotr Żmuda](https://piotrzmudadev.com)

- Daily numeric scales, sleep, physiology, 150 sports, 40 habit presets, custom activities with counts/times, context labels and optional notes.
- Account-saved check-in layouts and blank recurring routines, recent choices first, and activity-specific training fields.
- Historical check-in review with explainable notices and explicit confirmation of unusual observations.
- Filtered journals, unified Export & import with selective JSON/NDJSON/CSV/Markdown exports and reviewed imports.
- Collapsible per-page quick guides and a floating back-to-top control across desktop and mobile.
- Same-day and lagged relationships, trend-adjusted correlations, multiple-input Bayesian models, exploratory forecasts up to 28 days, uncertainty and chronological evaluation with cited methods.
- Private email/password accounts with recovery codes; aggregate administration; light/dark appearance with opt-in sunrise/sunset switching.
- Six authored interface languages; optional local country detection, with original notes preserved.
- A public `/demo` journal with synthetic observations and temporary edits for exploring the app before registration.

Email identifiers are unverified; save your recovery code. Records are private, while source is public. No AI provider or analytics tracker is connected. Analyses are observational, not causal or clinical conclusions. Registration has no application fee or user-count cap; Cloudflare quotas apply.

## Run and validate

Node.js 22.12+ and npm:

```sh
npm ci
npm run setup
npm run dev
```

Open `http://127.0.0.1:5173`. Local authentication bypass requires an explicit flag and loopback hostname; never enable it in production.

```sh
npm run format:check
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

## Documentation

| Topic                                                       | Reference                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Mathematics, priors, uncertainty and evaluation             | [Methodology](docs/METHODOLOGY.md)                        |
| Custom categories, event counts/times and analytical inputs | [Habits and activities](docs/HABITS.md)                   |
| Personal form layouts, routines and choice ordering         | [Personalization](docs/PERSONALIZATION.md)                |
| Fields, units, scales and missing values                    | [Data dictionary](docs/DATA_DICTIONARY.md)                |
| Collection, storage, privacy and retention                  | [Data lifecycle](docs/DATA_STORAGE.md)                    |
| Formats, round trips and conflict handling                  | [Import and export](docs/IMPORT_EXPORT.md)                |
| Account roles and aggregate statistics                      | [Administration](docs/ADMINISTRATION.md)                  |
| Components and API contracts                                | [Architecture](docs/ARCHITECTURE.md)                      |
| Appearance, motion and accessibility                        | [Interface](docs/INTERFACE.md)                            |
| Languages, canonical identifiers and local country lookup   | [Localization](docs/LOCALIZATION.md)                      |
| Shared examples and isolated demo experiments               | [Demo workspace](docs/DEMO.md)                            |
| Cloudflare deployment, quotas and recovery                  | [Operations](docs/DEPLOYMENT.md)                          |
| Minimal release packages and GitHub Pages                   | [Releases](docs/RELEASES.md)                              |
| Algorithm verification and test boundaries                  | [Testing](docs/TESTING.md)                                |
| Security and contribution rules                             | [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) |

TypeScript, React, Vite, Cloudflare Workers/D1/Durable Objects, Recharts, Zod, Vitest and Playwright. No license has been selected; public visibility alone does not grant redistribution rights.
