# Contributing

Tedd’mhen is maintained as a production-oriented application, with English source, UI copy, and documentation.

1. Install the Node.js version in `.nvmrc`, run `npm ci`, then `npm run setup`.
2. Keep a change focused and describe the user-visible behavior it affects.
3. Run `npm run format`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.
4. Add meaningful tests for changes to validation, statistics, ownership, concurrency, or exports. Use synthetic records only.
5. Update the data dictionary and methodology whenever a field, unit, anchor, or model changes. Version the schema or model when its interpretation changes.
6. Database migrations are append-only once deployed. Do not edit a migration already applied to a production database.

Keep missing observations distinct from zero. Do not make narrative interpretation an invisible part of the statistical model. Do not introduce clinical, causal, or calibrated forecasting claims without the validation needed to support them.

Never commit `.dev.vars`, credentials, database state, health records, real exports, or screenshots of private data. Do not print request bodies, JWTs, or session cookies in logs. Public issues and CI artifacts must contain only synthetic data.

The repository currently has no open-source license; agree on licensing before external redistribution or contribution under an assumed license.
