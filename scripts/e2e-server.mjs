import { spawnSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
const strict = process.argv.includes('--accounts');
const directory = resolve(strict ? '.wrangler/e2e-accounts' : '.wrangler/e2e');
const config = process.env.TEDDMHEN_RELEASE
  ? ['--config', resolve('release/package/wrangler.json')]
  : [];
// These isolated synthetic test stores are never used by local development or production.
rmSync(directory, { recursive: true, force: true });
const migration = spawnSync(
  'npx',
  ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', directory, ...config],
  { stdio: 'inherit' },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
if (!strict) {
  const administrator = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      ...config,
      '--persist-to',
      directory,
      '--command',
      "INSERT INTO users(id,email) VALUES ('local-developer','local@teddmhen.test'); INSERT INTO administrators(user_id) VALUES ('local-developer');",
    ],
    { stdio: 'inherit' },
  );
  if (administrator.status !== 0) process.exit(administrator.status ?? 1);
}
const server = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    ...config,
    '--local',
    '--local-upstream',
    '127.0.0.1',
    '--ip',
    '127.0.0.1',
    '--port',
    strict ? '8789' : '8788',
    '--persist-to',
    directory,
    '--var',
    strict ? 'LOCAL_DEV:false' : 'LOCAL_DEV:true',
  ],
  { stdio: 'inherit' },
);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
