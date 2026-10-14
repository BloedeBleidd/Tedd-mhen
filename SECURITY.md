# Security

The repository and sign-up pages are public; each account's journal is private.

## Authentication and ownership

- Private API endpoints verify a random application session against D1, its expiry, and the current account credential version. Every data query binds the verified owner ID; client-supplied IDs are never trusted.
- Passwords use salted scrypt (N=32768, r=8, p=3), executed in the AuthService Durable Object. This is an [OWASP-listed scrypt profile](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Password input is 12–128 characters for creation/change, with no silent truncation.
- Only hashes of random 256-bit session tokens and recovery codes enter D1. Production sessions use a seven-day Secure, HttpOnly, SameSite=Lax `__Host-` cookie. Sign-out removes the current session; password changes and recovery atomically invalidate all older sessions.
- Email identifiers are normalized but **unverified**. No email delivery, email recovery, social-account linking, or MFA is implemented. One-time recovery codes rotate on use and password change. Without a password or saved code, users cannot recover access through the app.
- Persistent AuthService throttling limits credential traffic to 30 requests per IP per ten minutes, and login/recovery to 10 per email per ten minutes. Limits apply to successful attempts too; they do not replace monitoring or provider abuse controls.
- Only `/api/auth/claim` uses Cloudflare Access for legacy migration. The Worker verifies the JWT signature, issuer, audience, expiry and identity. Legacy emails are reserved; claims retain the original owner ID. Never broaden this policy or accept a plain email header as proof.
- Local bypass requires both `LOCAL_DEV=true` and a loopback hostname. Production alternate hostnames are disabled. Fresh installations without legacy accounts can omit the Access configuration, leaving the claim endpoint unavailable.

Credential mutations require exact same-origin requests and a custom header. Data mutations also require the custom header and reject foreign origins. The API enables no CORS. Parameterized SQL, strict input/body limits, no-store responses, content security headers, CSV formula mitigation, and optimistic revisions add safeguards. Credential bodies are capped at 8 KiB; daily entries at 256 KiB.

## Storage and privacy

Static assets contain no private records or credentials and can be cached. Authenticated API responses must not be cached or overridden by Cache Rules. Passwords, recovery codes, session cookies, request bodies and private exports must never enter logs, source, public issues, screenshots or CI artifacts.

The application has no end-to-end encryption: the browser, Cloudflare infrastructure, and authorized account administrators can access records. Browser extensions and downloaded exports are outside its boundary. No analytics or AI API is connected. Optional approximate location stays in browser storage and is used only for local sunrise/sunset calculations; browser/OS location providers operate separately.

Deleting an account removes its active journal and sessions. Provider recovery windows and separate backups can retain older copies. Follow [Privacy & data](https://teddmhen.piotrzmudadev.com/privacy) and the [deployment guide](docs/DEPLOYMENT.md), including backup retention and restoration handling.

## Operations and reporting

Validate migrations, anonymous/private API boundaries, two-account isolation, recovery replay rejection, and deletion before deployment. Make a private backup before migrating. Keep Cloudflare MFA and least-privilege tokens, maintain dependencies, and monitor quotas and abuse. Free registration is not a promise of unlimited infrastructure.

Use GitHub private vulnerability reporting if enabled; otherwise contact the maintainer privately through their GitHub profile. Do not publish credentials, health data or an exploitable bypass in a public issue. Use synthetic reproduction records.
