import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
const issues = [];
const databaseId = config.d1_databases?.find((binding) => binding.binding === 'DB')?.database_id;
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId || '') ||
  databaseId === '00000000-0000-0000-0000-000000000000'
)
  issues.push('Set the database_id of your D1 database.');
if (!config.vars?.ACCESS_TEAM_DOMAIN || !config.vars?.ACCESS_AUD)
  issues.push('Configure ACCESS_TEAM_DOMAIN and ACCESS_AUD.');
if (!config.routes?.length)
  issues.push('Add your custom domain in routes and protect it with Cloudflare Access.');
if (config.vars?.LOCAL_DEV) issues.push('Remove LOCAL_DEV from production configuration.');
if (config.workers_dev !== false || config.preview_urls !== false)
  issues.push('Disable workers.dev and preview URLs; use the Access-protected custom domain.');
if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log('Deployment configuration is complete.');
