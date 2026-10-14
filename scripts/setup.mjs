import { access, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
try {
  await access('.dev.vars');
} catch {
  await writeFile('.dev.vars', 'LOCAL_DEV=true\n', { mode: 0o600 });
}
await mkdir('dist', { recursive: true });
try {
  await access('dist/index.html');
} catch {
  await writeFile('dist/index.html', '<p>Run npm run dev.</p>');
}
const result = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
