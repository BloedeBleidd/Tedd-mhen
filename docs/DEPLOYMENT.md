# Deploying Tedd’mhen to your Cloudflare account

The deployment uses a Worker with static assets, D1, one SQLite-backed AuthService Durable Object, and a custom domain. The owner's hostname is `teddmhen.piotrzmudadev.com`. Source is public; accounts and journals live in the owner's Cloudflare account. No external auth database or mail service is used.

## Prerequisites and configuration

Use Node.js 22.12+ or a supported newer LTS, npm, and an authenticated Cloudflare account:

```sh
npm ci
npx wrangler login
npx wrangler whoami
```

The owner's D1 database is already bound in `wrangler.jsonc` and was created in the EEUR region. Do not create another when maintaining this installation. Forks must replace the account/database IDs, custom domain and `APP_ORIGIN` with their own. A fresh installation can create its database with `npx wrangler d1 create teddmhen`.

Keep the `AUTH` binding, SQLite class migration, `nodejs_compat`, `workers_dev: false`, `preview_urls: false`, and `/api` Worker-first asset routing. Never set `LOCAL_DEV` in production. Development scripts explicitly keep the Wrangler upstream hostname on loopback. To test real account flows locally, use `LOCAL_DEV:false`; the browser suite also runs a separate strict account server. The two `.wrangler/e2e*` directories contain only synthetic test state and are reset at test-server startup.

`APP_ORIGIN` must exactly match the HTTPS custom-domain origin, without a trailing slash. Normal registration, sign-in and private API requests use application sessions, not Cloudflare Access. A fresh installation without legacy owners needs no Access setup and can omit both `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`.

## Migrating the existing private installation

Keep the original full-hostname Access protection in place until the new Worker and migration are installed. Never deploy the old Access-only API after opening the hostname without first restoring full-hostname protection.

1. Export a private backup before applying migration 0002. Inspect legacy identity counts and duplicate emails without exposing journal data. The migration intentionally fails on duplicate email reservations rather than merging journals.
2. Apply all D1 migrations. Migration 0002 creates account/session tables and reserves existing legacy emails. If the allowed owner has not saved an entry yet, reserve their normalized email in `auth_legacy_reservations` with a null `user_id` before registration opens. This personal deployment setting must not be committed in SQL migrations.
3. Deploy the new Worker, its AuthService class and assets while the old Access rule still protects the entire hostname.
4. Narrow the existing self-hosted Access application's domain to **`teddmhen.piotrzmudadev.com/api/auth/claim`**. Retain its audience, identity provider and owner-only Allow policy. Keep its 24-hour session and no Bypass/Everyone rules. Check that its destination list does not still cover the full hostname.
5. Confirm anonymous `/`, `/register` and `/privacy` are accessible; `/api/entries`, `/api/session` and `/api/export` return 401 without a session; `/api/auth/claim` still redirects to Access.
6. The original owner opens `/api/auth/claim`, signs in with the old allowed identity, and chooses their application password. Save the recovery code immediately. The verified subject remains the journal owner ID, preserving all original entries. Later sign-in uses email/password at `/sign-in`.

The Worker independently verifies the legacy Access JWT. A plain Cloudflare email header or a client-supplied legacy ID grants no access. The existing audience and team domain are public identifiers, not credentials. Once an account is claimed, repeating the claim cannot reset it.

Wrangler OAuth lacks Access administration permissions. A temporary account-scoped token needs `Access: Apps and Policies Edit`; identity-provider administration additionally needs `Access: Organizations, Identity Providers, and Groups Edit`. The ignored `.env.cloudflare` can hold that token for provisioning only. Never print or commit it. Remove/revoke it after setup. The application does not read that file at runtime.

## Validate, migrate, deploy

```sh
npm run format:check
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run db:migrate:remote
npm run deploy
```

Back up before the remote migration. `deploy` builds and checks D1, origin, the AuthService binding/migration, runtime compatibility, and disabled alternate hostnames. It cannot verify the external Access policy; test that separately. The GitHub workflow validates synthetic data and does not deploy pull requests.

Production smoke checks must cover two synthetic accounts, private CRUD and selective export, isolation, invalid credentials, recovery invalidating an old session/code, and account deletion. Remove test accounts afterward. Check cookie attributes, `Cache-Control: private, no-store`, CSP, and `Permissions-Policy: geolocation=(self)`. Test device-location permission and sunrise/sunset appearance in the browser; refusing permission must preserve manual/system themes.

## Verified release — 14 October 2026

Worker version `c3ebb621-c601-4ca0-8c44-aec92e23e7d2` was deployed with migration 0002, the AuthService binding and the claim-only Access policy. A private pre-migration SQL backup was restored into an isolated in-memory SQLite database to verify readability and counts. Validation passed formatting, TypeScript, 45 unit/API/configuration tests, 10 browser tests, the production build and a dependency audit with no reported vulnerabilities.

Production synthetic checks passed public-page access, anonymous API rejection, the legacy Access challenge, registration, secure session cookies, journal create/read/edit, selective export, two-account isolation, one-time recovery and old-session invalidation, sign-out/sign-in, and light/dark/privacy UI on desktop/mobile. Both synthetic accounts and their records were deleted and cleanup was verified in D1. Alternate endpoints are disabled and no production `LOCAL_DEV` binding exists. The original owner confirmed setting a password, saving the recovery code and reaching Overview through the migration flow.

## Backups and restoration

A full database export preserves identities, credential hashes, revisions and timestamps. Treat it as sensitive:

```sh
npx wrangler d1 export teddmhen --remote --output /private/backup-location/teddmhen.sql
```

Use a protected private directory, restrictive file permissions and encryption where appropriate. Never attach backups to issues or CI. Keep manual migration backups for at most 30 days unless an incident requires a documented exception; remove them explicitly. No automated backup scheduler is installed. Application exports are user-controlled copies and are not deleted when an account is deleted.

Test restoration into a **separate empty database** before changing a production binding. Compare owner and entry counts. Restoring an older database can restore deleted records and old credential hashes: invalidate restored sessions, reconcile deletions, and handle recovered credentials deliberately before reopening access. Do not blindly restore a backup over a live database.

D1 Time Travel retains recovery points according to the plan (7 days Free, 30 days Paid at this release). Consult [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) and [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1). Backups and recovery points can outlive deletion from the active database.

## Free pilot and capacity

There is no application-imposed user-count cap or subscription fee. Cloudflare infrastructure has quotas; no paid upgrade is performed by the application or local setup.

- [Workers Free](https://developers.cloudflare.com/workers/platform/limits/): 100,000 dynamic requests/day and 10 ms CPU per invocation. Static assets have separate accounting.
- [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/): 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. The [per-database limit](https://developers.cloudflare.com/d1/platform/limits/) is 500 MB on Free.
- [SQLite Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/): 100,000 requests/day and 13,000 GB-s/day, with storage operation quotas. Password hashing runs here because the [default CPU allowance](https://developers.cloudflare.com/durable-objects/platform/limits/) is 30 seconds, rather than the Worker's 10 ms.

These are provider limits at this release, not app-level promises; verify current account usage and pricing. Quota exhaustion can prevent sign-in or saving data. The pilot uses one AuthService instance and a persistent ten-minute abuse limiter (30 credential requests/IP; 10 login/recovery attempts/email). Monitor traffic, database growth, rate limits and errors before widening adoption. A public signup endpoint can consume capacity even without a user-count cap.

Daily JSON is limited to 256 KiB, notes to 50,000 characters, and days to 20 training sessions. Exports stream batches of 50 and accept 1,831 dates; non-streaming browsers have a 64 MiB download buffer cap. Avoid concurrent edits during export because batches are not a snapshot. R2 archives, attachments, shared journals, email verification/delivery and MFA are not implemented.
