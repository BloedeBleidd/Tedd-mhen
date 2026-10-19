# Deploying Tedd’mhen to your Cloudflare account

The deployment uses a Worker with static assets, D1, one SQLite-backed AuthService Durable Object, and a custom domain. The owner's hostname is `teddmhen.piotrzmudadev.com`. Source is public; accounts and journals live in the owner's Cloudflare account. No external auth database or mail service is used.

Deploy from this source checkout or use the compiled Cloudflare archive from [Releases](RELEASES.md). The archive includes the Worker, browser assets, migrations and its own deployment instructions. GitHub Pages serves documentation only.

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

## Database schema prerequisites

Apply the complete migration chain before serving the matching Worker. Deployed migrations are immutable; schema and fixture changes use additional migrations. Back up D1 and verify restoration before applying pending migrations.

| Required component              | Migration                    | Operational contract                                                |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| Owner-scoped daily journal      | `0001_initial.sql`           | Users, entries and revision-based writes                            |
| Application accounts            | `0002_accounts.sql`          | Credentials, sessions and reserved legacy identities                |
| Administrator roles             | `0003_administrators.sql`    | Explicit grants by immutable user ID; no automatic role assignment  |
| Shared synthetic journal        | `0004_demo_journal.sql`      | 236 observations, dataset metadata and baseline/credential guards   |
| Private custom activity library | `0005_habit_definitions.sql` | Owner-scoped definitions and successful-entry-write import triggers |
| Synthetic habit observations    | `0006_demo_habits.sql`       | Reproducible demo fixture with baseline guards preserved            |
| Personal layouts and routines   | `0007_preferences.sql`       | Per-setting owner keys, usage metadata and account-deletion cascade |

Migration 0006 replaces and reinstates the demo update guard within its transaction; insert, delete and credential guards remain in place. Migration 0007 creates a separate settings table without rewriting observations, credentials, definitions or the demo baseline. Retain additive tables during a Worker rollback. A Worker that predates habit preservation can discard habit fields on entry updates; prefer a forward fix and verify data compatibility before any rollback.

## Validate, migrate, deploy

```sh
npm run format:check
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Create and verify the private backup described below, then apply pending migrations and deploy:

```sh
npm run db:migrate:remote
npm run deploy
```

`deploy` builds and checks D1, origin, the AuthService binding/migration, runtime compatibility, and disabled alternate hostnames. It cannot verify an external Access policy; test legacy claim protection separately when configured. The GitHub workflow validates synthetic data and does not deploy pull requests. For deployment of an already tested compiled artifact, follow [Releases](RELEASES.md).

## Production verification

Use two short-lived synthetic accounts and remove them after verification. Never copy personal journal data into tests or public logs.

| Area                              | Expected behavior                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and isolation      | Invalid credentials fail; private CRUD and exports remain owner-scoped; recovery invalidates the previous session and code; account deletion removes owned active data                                                                                        |
| Personalization                   | Anonymous reads and cross-origin writes fail; independent settings persist without replacing each other; request failure offers retry; subsequent blank days contain routine identities with null measurements                                                |
| Custom activities and portability | Private libraries remain isolated; imports restore custom definitions only after successful writes; stale revisions and clients omitting recorded habits cannot erase observations                                                                            |
| Public demo                       | `/demo` and `/api/demo` work anonymously with only the synthetic baseline; ordinary private APIs return 401; signed-in demo visits redirect to the private journal; edits and settings disappear on exit or reload; registration starts with an empty journal |
| Administration                    | The granted owner sees Administration; ordinary accounts receive 403 from `/api/admin/overview`; anonymous requests receive 401                                                                                                                               |
| Analysis and interface            | Relationship and multivariable views handle missing observations; mobile layouts, external author links, input feedback and import previews remain usable                                                                                                 |
| Language and appearance           | Six source catalogs render; canonical IDs and original notes survive language changes; location permission is explicit; Auto uses English/light without location and follows local geography/sunrise/sunset with coordinates; manual choices take precedence  |
| Response protections              | Session cookie attributes, `Cache-Control: private, no-store`, CSP and `Permissions-Policy: geolocation=(self)` match configuration                                                                                                                           |

The synthetic journal is part of the migration chain and release archive, with no external service or recurring seed job. See [Demo workspace](DEMO.md) for dataset provenance and its temporary browser workspace.

## Administrator access

The `administrators` table contains explicit grants by immutable user ID. For the owner's installation, use the independently verified and claimed owner account. For another installation, verify ownership through a trusted channel before granting a role. A matching registration email is not proof because addresses are unverified. Follow [Administration](ADMINISTRATION.md) for parameterized grant/revoke operations and metric definitions.

Revocation takes effect on the next API request without changing journal ownership. Registration cannot assign an administrator role.

## Legacy owner migration

This procedure applies only to an installation that still uses Cloudflare Access for the entire application and needs to migrate existing owners. Normal maintenance of an email/password installation does not repeat it. Keep full-hostname Access protection until the application-session Worker and account schema are installed. An Access-only Worker must never serve an open hostname.

1. Export a private backup before applying migration 0002. Inspect legacy identity counts and duplicate emails without exposing journal data. The migration intentionally fails on duplicate email reservations rather than merging journals.
2. Apply all D1 migrations. Migration 0002 creates account/session tables and reserves existing legacy emails. If the allowed owner has not saved an entry yet, reserve their normalized email in `auth_legacy_reservations` with a null `user_id` before registration opens. This personal deployment setting must not be committed in SQL migrations.
3. Deploy the application-session Worker, its AuthService class and assets while the Access rule still protects the entire hostname.
4. Narrow the existing self-hosted Access application's domain to **`teddmhen.piotrzmudadev.com/api/auth/claim`**. Retain its audience, identity provider and owner-only Allow policy. Keep its 24-hour session and no Bypass/Everyone rules. Check that its destination list does not still cover the full hostname.
5. Confirm anonymous `/`, `/register` and `/privacy` are accessible; `/api/entries`, `/api/session` and `/api/export` return 401 without a session; `/api/auth/claim` still redirects to Access.
6. The original owner opens `/api/auth/claim`, signs in with the old allowed identity, and chooses their application password. Save the recovery code immediately. The verified subject remains the journal owner ID, preserving all original entries. Later sign-in uses email/password at `/sign-in`.

The Worker independently verifies the legacy Access JWT. A plain Cloudflare email header or a client-supplied legacy ID grants no access. The existing audience and team domain are public identifiers, not credentials. Once an account is claimed, repeating the claim cannot reset it.

Wrangler OAuth lacks Access administration permissions. A temporary account-scoped token needs `Access: Apps and Policies Edit`; identity-provider administration additionally needs `Access: Organizations, Identity Providers, and Groups Edit`. The ignored `.env.cloudflare` can hold that token for provisioning only. Never print or commit it. Remove/revoke it after setup. The application does not read that file at runtime.

## Backups and restoration

A full database export preserves identities, credential hashes, revisions and timestamps. Treat it as sensitive:

```sh
npx wrangler d1 export teddmhen --remote --output /private/backup-location/teddmhen.sql
```

Use a protected private directory, restrictive file permissions and encryption where appropriate. Wrangler export output can contain a signed download URL: capture output privately and never paste it into public logs. Never attach backups to issues or CI. Keep manual migration backups for at most 30 days unless an incident requires a documented exception; remove them explicitly. No automated backup scheduler is installed. Application exports are user-controlled copies and are not deleted when an account is deleted.

Test restoration into a **separate empty database** before changing a production binding. Compare owner and entry counts. Restoring an older database can restore deleted records and old credential hashes: invalidate restored sessions, reconcile deletions, and handle recovered credentials deliberately before reopening access. Do not blindly restore a backup over a live database.

D1 Time Travel retains recovery points according to the plan (7 days Free, 30 days Paid at the time of writing). Consult [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) and [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1). Backups and recovery points can outlive deletion from the active database.

## Free pilot and capacity

There is no application-imposed user-count cap or subscription fee. Cloudflare infrastructure has quotas; no paid upgrade is performed by the application or local setup.

- [Workers Free](https://developers.cloudflare.com/workers/platform/limits/): 100,000 dynamic requests/day and 10 ms CPU per invocation. Static assets have separate accounting.
- [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/): 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. The [per-database limit](https://developers.cloudflare.com/d1/platform/limits/) is 500 MB on Free.
- [SQLite Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/): 100,000 requests/day and 13,000 GB-s/day, with storage operation quotas. Password hashing runs here because the [default CPU allowance](https://developers.cloudflare.com/durable-objects/platform/limits/) is 30 seconds, rather than the Worker's 10 ms.

These are provider limits at the time of writing, not app-level promises; verify current account usage and pricing. Quota exhaustion can prevent sign-in or saving data. The pilot uses one AuthService instance and a persistent ten-minute abuse limiter (30 credential requests/IP; 10 login/recovery attempts/email). Monitor traffic, database growth, rate limits and errors before widening adoption. A public signup endpoint can consume capacity even without a user-count cap.

Daily JSON is limited to 256 KiB, notes to 50,000 characters, and days to 20 training sessions and 100 habit categories (500 local times each). Custom names allow 120 characters and library listings reject more than 10,000 definitions. Exports stream batches of 50 and accept 1,831 dates; non-streaming browsers have a 64 MiB download buffer cap. Imports accept at most 500 days / 20 MiB per file. All-history analysis accepts 10,000 recorded days and rejects larger selections explicitly. Avoid concurrent edits during export because batches are not a snapshot. R2 archives, attachments, shared journals, email verification/delivery and MFA are not implemented.
