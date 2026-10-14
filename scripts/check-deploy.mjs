import { readFile } from 'node:fs/promises';
import { parse, printParseErrorCode } from 'jsonc-parser';
const parseErrors = [];
const config = parse(await readFile(process.argv[2] || 'wrangler.jsonc', 'utf8'), parseErrors, {
  allowTrailingComma: true,
});
if (parseErrors.length || !config || typeof config !== 'object' || Array.isArray(config)) {
  console.error(
    'Invalid Wrangler configuration: ' +
      (parseErrors.length
        ? parseErrors
            .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
            .join(', ')
        : 'expected an object.'),
  );
  process.exit(1);
}
const issues = [];
const databaseId = config.d1_databases?.find((binding) => binding.binding === 'DB')?.database_id;
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId || '') ||
  databaseId === '00000000-0000-0000-0000-000000000000'
)
  issues.push('Set the database_id of your D1 database.');
if (Boolean(config.vars?.ACCESS_TEAM_DOMAIN) !== Boolean(config.vars?.ACCESS_AUD))
  issues.push(
    'Configure both ACCESS_TEAM_DOMAIN and ACCESS_AUD for legacy migration, or neither for a fresh installation.',
  );
if (!config.routes?.length) issues.push('Add your custom domain in routes.');
const origin = config.vars?.APP_ORIGIN;
if (
  !origin ||
  !config.routes?.some(
    (route) => route.custom_domain === true && origin === `https://${route.pattern}`,
  )
)
  issues.push('Set APP_ORIGIN to the HTTPS custom-domain origin.');
if (
  !config.durable_objects?.bindings?.some(
    (binding) => binding.name === 'AUTH' && binding.class_name === 'AuthService',
  )
)
  issues.push('Bind AUTH to the AuthService Durable Object.');
if (!config.migrations?.some((migration) => migration.new_sqlite_classes?.includes('AuthService')))
  issues.push('Include the SQLite AuthService class migration.');
if (!config.compatibility_flags?.includes('nodejs_compat'))
  issues.push('Enable nodejs_compat for password hashing.');
if (config.vars?.LOCAL_DEV) issues.push('Remove LOCAL_DEV from production configuration.');
if (config.workers_dev !== false || config.preview_urls !== false)
  issues.push('Disable workers.dev and preview URLs; use the configured custom domain.');
if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log('Deployment configuration is complete.');
