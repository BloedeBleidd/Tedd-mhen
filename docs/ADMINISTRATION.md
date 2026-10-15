# Administration

## Authorization

Administrator privileges are stored in `administrators`, keyed by the existing internal user ID. Registration, email strings, request headers and client state cannot grant a role. This matters because public email/password accounts use unverified email identifiers.

The owner’s previously verified legacy account is the administrative identity. A separate account created with another email has ordinary user privileges. The navigation exposes Administration only for a verified administrator session, and every `/api/admin/*` request independently checks the database grant. An ordinary authenticated account receives 403; an anonymous request receives 401.

Migration `0003_administrators.sql` creates the role table without granting privileges. Provision a grant only after independently verifying the intended existing account. Resolve its immutable user ID, then use a parameterized administrative database operation:

```sql
INSERT INTO administrators(user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING;
```

Do not grant by accepting an email from a registration request. Removing the row revokes access on the next request. Deleting that user also deletes the grant; recreating the same email generates a different ID and does not inherit administration. Keep personal deployment identity values outside public migrations.

## Dashboard definitions

`GET /api/admin/overview` returns aggregate values only:

- Registered accounts and accounts created during the last 7/30 UTC days.
- Stored daily entries and distinct accounts with entries.
- Total UTF-8 bytes of journal JSON (`length(CAST(data AS BLOB))`). This excludes indexes, account/session rows and SQLite overhead; it is not provider-billed database size.
- Earliest/latest recorded journal dates and entries whose latest update occurred within seven days.
- Accounts with at least one unexpired session at the current credential version. This is not a count of people currently online.
- Account creation counts by UTC date over the past 30 days.
- Shared demo entry count and UTF-8 JSON bytes, shown separately. Demo records are excluded from personal journal totals; the technical owner has no credentials and is excluded from registered account counts.

Deleted records/accounts do not contribute. Queries form an operational snapshot and can observe concurrent changes between statements. The panel exposes no journal bodies, account email list, passwords, recovery hashes or session tokens. Cloudflare’s dashboard remains authoritative for infrastructure usage, quotas and billing. Responses use `private, no-store`.
