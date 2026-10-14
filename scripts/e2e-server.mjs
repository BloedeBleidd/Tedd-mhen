import { spawnSync, spawn } from 'node:child_process';
const migration = spawnSync(
  'npx',
  ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', '.wrangler/e2e'],
  { stdio: 'inherit' },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
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
    '8788',
    '--persist-to',
    '.wrangler/e2e',
    '--var',
    'LOCAL_DEV:true',
  ],
  { stdio: 'inherit' },
);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
