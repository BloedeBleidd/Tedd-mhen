# Deploying Tedd’mhen to your Cloudflare account

The deployment consists of one Worker, its static assets, a D1 database, a custom domain, and a Cloudflare Access application. Source is public; records stay in your account. No Sites hosting or external application database is required.

The production hostname is `teddmhen.piotrzmudadev.com`, under the owner's `piotrzmudadev.com` zone. The Worker, custom domain, D1 database, and Access application were provisioned on the owner's account on October 14, 2026.

The production Access application covers every path and allows only the owner's email through the existing Cloudflare identity provider, with a 24-hour session. It has no Bypass or Everyone policy. Both `workers.dev` and deployment preview URLs are disabled. The team domain and application audience in `wrangler.jsonc` identify the application; they are not credentials.

Deployment verification confirmed HTTPS redirects to Access for signed-out requests to `/`, `/journal`, `/api/entries`, and `/api/health`, the correct D1 binding, and the absence of `LOCAL_DEV` in the deployed Worker. Local validation passed 31 unit/API/configuration tests and three browser tests, plus formatting, TypeScript, and the production build. Completing the signed-in production smoke test below requires the owner's browser session; local browser tests do not establish that result.

Development and test commands explicitly keep Wrangler's upstream hostname on loopback. Otherwise Wrangler can rewrite local request URLs to the configured production hostname, correctly causing the local authentication bypass to refuse those requests.

## 1. Prerequisites

- Node.js 22.12+ or a supported newer LTS, npm, and this repository.
- A Cloudflare account with a zone for your intended custom domain.
- Cloudflare Zero Trust / Access enabled for your account.

```sh
npm ci
npx wrangler login
npx wrangler whoami
```

Use your local authenticated session or scoped deployment credentials. Never put a token in source, chat, a shell command argument, or a public issue. For CI later, use protected secrets and the minimum Worker/D1 permissions needed. This repository intentionally does not auto-deploy from pull requests.

Wrangler OAuth does not include Access administration permissions. If Access is not enabled, complete the [Zero Trust onboarding](https://developers.cloudflare.com/cloudflare-one/setup/) in the account dashboard first, selecting the intended plan and team name. Cloudflare may require payment details even for its Free plan.

To configure Access through the API, use a separate account-scoped API token with `Access: Apps and Policies Edit` and `Access: Organizations, Identity Providers, and Groups Edit`. Limit it to the deployment account. An ignored local `.env.cloudflare` file can hold `CLOUDFLARE_API_TOKEN=...` while provisioning; it is not loaded by the application or committed. Remove the file and revoke the temporary token after provisioning. Alternatively, configure the application in the dashboard as described below without issuing an additional API token.

## 2. Create and bind the database

```sh
npx wrangler d1 create teddmhen
```

For a new installation, copy the returned database UUID into `d1_databases[0].database_id` in `wrangler.jsonc`. The binding name must remain `DB`. Set `account_id` to the intended account explicitly if your credentials have access to multiple accounts. Account and database IDs are identifiers, not authentication tokens.

The owner's production database `teddmhen` has already been created in Cloudflare's EEUR region, migrated, and bound in this repository's configuration. Do not create another database when maintaining this deployment. A fork must use its own account, database, domain, and Access configuration.

## 3. Configure private access before serving real data

For a new installation, create a self-hosted Access application in Cloudflare Zero Trust covering every path on your hostname. Add an Allow policy restricted to your email. Configure an identity provider or email one-time PIN. Avoid a Bypass policy or an Everyone allow rule. The owner's installation already uses the existing Cloudflare identity provider; it does not require a separate application password or one-time PIN provider.

Copy the team domain and Application Audience (AUD) into `vars`:

```json
{
  "ACCESS_TEAM_DOMAIN": "your-team.cloudflareaccess.com",
  "ACCESS_AUD": "your-application-audience"
}
```

The hostname is already declared as a Worker custom domain in `wrangler.jsonc`:

```json
"routes": [
  { "pattern": "teddmhen.piotrzmudadev.com", "custom_domain": true }
]
```

Keep `workers_dev: false` and `preview_urls: false` unless you separately protect and verify every alternate hostname. Do not configure `LOCAL_DEV` in Cloudflare. It belongs only in ignored `.dev.vars` for loopback development.

The browser loads through Access. The Worker independently verifies the JWT using the account’s public keys, issuer, audience, expiry, and subject/email claims. A spoofed email header does not grant access. See Cloudflare’s [JWT validation documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## 4. Validate, migrate, and deploy

```sh
npm run format:check
npm run typecheck
npm test
npm run setup
npx playwright install chromium
npm run test:e2e
npm run db:migrate:remote
npm run deploy
```

`deploy` builds the application and checks for the configured database, custom domain, and Access parameters before calling Wrangler. A syntax/configuration check cannot verify the Access policy itself: validate the signed-out and signed-in flows in the dashboard/browser.

The UI and API are one deployment. Static-asset routing forces `/api` and `/api/*` through the Worker; unrecognized API URLs return JSON 404 responses rather than the SPA. See Cloudflare’s [SPA routing documentation](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

## 5. Verify the deployed application

1. A signed-out browser is challenged by Access before entering the journal.
2. Sign in as the allowed identity. Create a clearly marked test entry, reload it, edit it, export it, and delete it.
3. An unauthenticated direct API request must not expose entries. A token with the wrong audience must be rejected.
4. Check the custom domain on a phone. Confirm that a hard refresh on `/journal` and `/analysis` works.
5. Confirm `Cache-Control: private, no-store` on authenticated API responses and no cache rule overriding it.
6. Confirm that all production hostnames are protected and the Worker has no `LOCAL_DEV` variable.

## Backups and restore

Selective app exports are useful for analysis, but a database backup also preserves owner identities, revisions, and timestamps. Use a private destination outside the repository:

```sh
npx wrangler d1 export teddmhen --remote --output /private/backup-location/teddmhen.sql
```

Replace the destination with a protected directory on your machine. Encrypt and retain backups according to your needs. Do not attach them to issues or CI artifacts. To test restoration, import into a **separate empty** D1 database and verify counts, sample records, and ownership before changing any production binding. Keep a tested rollback plan for migrations.

Cloudflare D1 also offers point-in-time recovery (Time Travel), subject to plan-specific retention. Follow the current [Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/) and [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1). Restoring a live database can replace recent records; choose the intended recovery point deliberately.

## Capacity and operations

According to the [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), database size, total storage, query quotas, and retention depend on the Cloudflare plan. At implementation time, database limits are 500 MB on Free and 10 GB on Paid, and a single row is limited to 2,000,000 bytes. Verify current limits in your account before choosing capacity or cost assumptions.

The app caps daily JSON requests at 256 KiB. Summaries omit long notes. Exports stream 50 rows at a time and accept a maximum date span of 1,830 days (1,831 dates); this bounds D1 queries per request. Chromium’s file-save API can stream directly to disk; other browsers buffer at most 64 MiB and ask you to use a smaller range if exceeded. Avoid concurrent edits during an export because batches are not a transactionally frozen snapshot.

For materially larger archives, plan an R2 tier and metadata/index migration; this release does not implement it. Monitor D1 database growth and read/write usage. Text search is a substring scan within an owner/date range. Add indexes or full-text search in response to measured usage.

No backup schedule, production resources, billing changes, or custom domain are provisioned merely by cloning or running local development. The public GitHub Actions workflow only validates source with synthetic test data.
