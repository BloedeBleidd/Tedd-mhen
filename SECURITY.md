# Security

The repository is public; the deployed journal and its records are intended to be private.

## Access boundary

- Cloudflare Access protects the complete custom domain. Configure an Allow policy for the intended identity; avoid broad allow rules.
- The Worker independently verifies the Access JWT signature, issuer, audience, expiry, and required identity claims.
- Every read, update, delete, and export binds the verified owner identifier. No owner ID supplied by the browser is trusted.
- Missing production Access configuration returns HTTP 503. Missing or invalid authentication returns HTTP 401.
- The explicit local bypass additionally requires a loopback hostname. `.dev.vars` is ignored and must not be uploaded as production variables.
- Production `workers.dev` and preview URLs are disabled in the default configuration.

Mutations require a same-origin request and a custom header. The API does not enable CORS. Parameterized SQL, strict input validation, body limits, no-store responses, content security headers, CSV formula mitigation, and optimistic revisions provide additional safeguards.

Static assets contain no private records or credentials. They can be cached; authenticated API responses must not be cached. Do not add a Cloudflare Cache Rule that overrides API `Cache-Control`.

## Operational responsibility

Deploy only after configuring the Access policy and database binding. Test both the signed-in and signed-out experience. Keep Node.js, Wrangler, and application dependencies updated; inspect `npm audit` reports. Store backups outside the repository and protect them like the live database. Configure account MFA and least-privilege Cloudflare tokens.

The application has no end-to-end encryption: your browser, Cloudflare infrastructure, and authorized account administrators can access records. Browser extensions and exports are outside the app’s access boundary. No third-party analytics or AI API is included.

## Reporting an issue

Use the repository’s private vulnerability reporting feature if enabled. Otherwise contact the maintainer privately through their GitHub profile. Do not post credentials, real health data, or an exploitable access bypass in a public issue. Use synthetic records to describe the impact and reproduction.
