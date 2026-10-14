# Releases and publication

## Repository and deployment package

Git stores the source, dependency lockfile, migrations, tests, build configuration and topic documentation. Generated output, dependencies, credentials, databases, exports, local screenshots and backups are ignored. No generated deployment bundle is committed.

The Cloudflare release archive contains only:

- `worker.js`: bundled Worker and AuthService, including required runtime dependencies.
- `dist/`: compiled browser assets and response headers.
- `migrations/`: append-only D1 migrations.
- `wrangler.json`: production bindings and domain, with rebundling disabled.
- `DEPLOY.md`: instructions using the exact Wrangler version used to build the release.
- `manifest.json`: version, source commit, Wrangler version, lockfile digest, file sizes and SHA-256 digests.

`SHA256SUMS` accompanies the archive. Neither file includes credentials or database contents. Account IDs, database IDs and the legacy Access audience in the configuration are public identifiers. The package targets the existing owner installation; another installation must change these identifiers and its domain before deploying. Dependency license notices remain in the compiled bundles.

## Build and validate

Use Linux with Node.js 22.12+, npm, Git and GNU tar. Commit the intended version and all source changes first: the builder requires a clean tracked tree and builds an isolated `git archive HEAD` checkout with `npm ci`. Ignored local files cannot enter that checkout.

```sh
npm ci
npm run release:build
npx playwright install chromium
npm run release:test
```

The output is `release/teddmhen-<version>-cloudflare.tar.gz` and `release/SHA256SUMS`. The builder rejects unexpected files and symlinks, checks production configuration and runs a Wrangler deployment dry run. It then extracts the actual archive to `release/package/`. The complete browser suite runs against that extracted Worker, assets and migrations, including real password/recovery flows and owner isolation. Test databases remain in ignored `.wrangler/e2e*` directories. Build and test commands do not access a remote database or deploy to Cloudflare.

The manifest identifies the exact source and locked dependencies. File ordering and archive timestamps are normalized; byte-identical output across different toolchain versions is not guaranteed. Checksums detect a changed download; they are not a cryptographic publisher signature.

## Publish a version

Update the numeric `major.minor.patch` in `package.json` and `package-lock.json`, commit it to `main`, then tag that commit. For example, when publishing version 0.1.0:

```sh
git tag -a v0.1.0 -m "Tedd’mhen 0.1.0"
git push origin v0.1.0
```

CI checks formatting, types, unit/API tests and dependencies, builds the archive, and runs the browser suite against it. Only a matching `v<package version>` tag can publish a GitHub Release. The release job receives only the archive and checksum file, uses a job-scoped write token, and never receives Cloudflare credentials. Intermediate release artifacts expire after one day; published release attachments remain until explicitly removed. A published release is not overwritten on a rerun. Fixes use a new version and tag.

GitHub also provides automatic source archives, which are separate from the attached Cloudflare package. Download the `-cloudflare.tar.gz` attachment for deployment. Verify it in the same directory as `SHA256SUMS` with `sha256sum -c SHA256SUMS`, extract it and follow its `DEPLOY.md`. Back up before migrations and follow [Deployment](DEPLOYMENT.md) for production checks and recovery. Publishing a GitHub Release does not change the running Cloudflare application.

## GitHub Pages documentation

Pages publishes the existing Markdown files from `main` → `/docs` at `https://bloedeBleidd.github.io/Tedd-mhen/`. In repository **Settings → Pages**, the source is **Deploy from a branch**, branch **main**, folder **/docs**. GitHub's built-in Jekyll build renders these files using `_config.yml`; relative Markdown links are rewritten to their HTML pages. No separate copy of the documentation or generated site is committed. Changes on `main` update the documentation independently of release tags.

Pages hosts documentation only. Accounts, health records, APIs and application assets remain on Cloudflare. Never select the repository root or an operational backup directory as the Pages source.

References: [Wrangler bundling](https://developers.cloudflare.com/workers/wrangler/bundling/), [GitHub release creation](https://cli.github.com/manual/gh_release_create), [Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
