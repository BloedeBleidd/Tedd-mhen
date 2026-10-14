import { spawnSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
const strict = process.argv.includes('--accounts');
const directory = strict ? '.wrangler/e2e-accounts' : '.wrangler/e2e';
// These isolated synthetic test stores are never used by local development or production.
rmSync(directory, { recursive: true, force: true });
const migration = spawnSync(
  'npx',
  ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', directory],
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
