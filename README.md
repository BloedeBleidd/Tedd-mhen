# Tedd’mhen

A personal training and recovery journal with structured health metrics, Bayesian trend analysis, and flexible data exports for external AI analysis. Built for Cloudflare with private accounts and automatic light/dark appearance.

Tedd’mhen helps you record how you train, sleep, and feel, then explore your own longitudinal data. Subjective experiences use explicitly anchored numeric scales; free-text notes provide optional context. The application does not call an LLM or transmit your records to an AI provider.

**Status:** functional pilot, deployed to the owner's Cloudflare account with automated validation. The statistical model is exploratory; computational tests do not establish clinical validity or forecasting calibration.

![Tedd’mhen overview with synthetic demonstration data](docs/images/overview.png)

## Features

- **Overview:** recent observations, recording consistency, training volume, and sleep / wellbeing charts.
- **Daily check-in:** wellbeing, energy, motivation, fatigue, stress, soreness, illness severity, symptom severity, sleep timing and duration, sleep ratings, HRV, respiratory rate, resting heart rate, and training sessions.
- **Training:** running, strength, cycling, swimming, walking, mobility, and other activities; duration, distance, perceived effort, pain, and strength sets.
- **Journal:** date and activity filters, illness filters, text search, pagination, editing, and deletion with revision checks.
- **Bayesian trends:** exact conjugate linear regression, explicit priors, 95% credible and predictive intervals, short extrapolations, missing-data handling, and model diagnostics.
- **Selective export:** JSON, NDJSON, CSV, and Markdown with selectable data groups. JSON, NDJSON, and Markdown include metadata and a data dictionary. Optional notes are excluded unless selected.
- **Accounts:** public email/password registration, one-time recovery codes, password changes, sign-out, and account deletion. Email identifiers are unverified; no mail service is connected.
- **Appearance:** Light, Dark, or Auto. With opt-in device location, Auto follows sunrise and sunset calculated in the browser; without location it follows system appearance.
- **Privacy:** owner-scoped queries, necessary-cookie notice, an accessible Privacy & data page, no analytics trackers, no third-party fonts, and no real records in the repository.

## Stack

TypeScript · React · Vite · Cloudflare Workers Static Assets · Cloudflare D1 (SQLite) · SQLite Durable Objects · Recharts · Zod · Vitest · Playwright.

The public source repository is separate from your private deployment and database. Each account has its own journal, with no sharing between accounts. Pilot registration has no application-imposed user-count cap or subscription fee. Hosting is subject to finite Cloudflare quotas; this is not unlimited free infrastructure.

## Local development

Use Node.js 22.12+ (or a supported newer LTS) and npm.

```sh
npm ci
npm run setup
npm run dev
```

Open `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:8787`. Setup applies local D1 migrations and creates an ignored `.dev.vars` containing `LOCAL_DEV=true`. Authentication bypass requires both this flag and a loopback request hostname. It must never be used in a deployed environment.

Local data lives in ignored `.wrangler/` state. The optional demo contains synthetic records, runs in memory, and never writes them into D1.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Deploy to your Cloudflare account

Follow [the deployment guide](docs/DEPLOYMENT.md) to provision D1 and AuthService, configure the custom domain, apply migrations, and deploy. No Cloudflare credentials are stored in source. Private API endpoints require a valid application session.

Deployment: [teddmhen.piotrzmudadev.com](https://teddmhen.piotrzmudadev.com). Create an account with an email identifier and a unique password of 12–128 characters. **Save the recovery code shown at registration.** It is displayed once; recovery or a password change replaces it and signs out older sessions. There is no email reset flow.

The original owner migrates existing records once at [/api/auth/claim](https://teddmhen.piotrzmudadev.com/api/auth/claim), verifies their legacy Cloudflare identity, and creates a password. Their existing owner ID and journal remain unchanged. Ordinary registration and sign-in do not use Cloudflare Access. Forks require their own Cloudflare resources.

Use **Appearance → Auto → Use device location** for sunrise/sunset switching. Location is requested only after the button is clicked, rounded to two decimal places, and stored only in that browser. Update it when travelling or forget it at any time. Read **Privacy & data** for cookie lifetimes, database storage, deletion, backups, and exports.

## Data and analysis

Read the [data dictionary](docs/DATA_DICTIONARY.md), [statistical methodology](docs/METHODOLOGY.md), and [architecture notes](docs/ARCHITECTURE.md).

- Missing values stay `null`; they are never silently converted to zero.
- A day of rest must be explicitly recorded. Missing effort makes training load unknown.
- Sleep belongs to the date you wake up. Sleep duration is entered independently from time in bed.
- Rating anchors are project-defined and must be used consistently; they are not validated clinical instruments.
- Results describe within-person observations under model assumptions. They are not diagnoses, causal effects, or treatment recommendations.
- Wearable scores and HRV methods are not interchangeable across sources.

Long narratives are stored in D1 but excluded from list and analysis payloads. Daily request bodies are capped at 256 KiB, individual notes at 50,000 characters. Exports stream rows in batches and accept up to 1,831 calendar days per request. D1 has finite storage and plan quotas; see the deployment guide before assuming unlimited capacity. Attachments and an R2 archive tier are not implemented.

## Repository practices

Changes must pass type checks, statistical / validation tests, a production build, and browser checks. Keep real health data, database exports, credentials, and local state out of issues, commits, screenshots, and CI artifacts. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

No license has been selected yet. Public visibility alone does not grant an open-source license.
