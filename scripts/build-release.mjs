import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'jsonc-parser';
import { inventory, releaseConfig, releaseIdentity, sha256 } from './release-files.mjs';

const root = resolve('.');
function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status ?? result.error?.message}).`);
  return result.stdout?.trim();
}

run('git', ['diff', '--quiet', 'HEAD', '--']);
const commit = run('git', ['rev-parse', 'HEAD'], root, true);
const timestamp = run('git', ['show', '-s', '--format=%ct', 'HEAD'], root, true);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
const name = releaseIdentity(version, commit, tag);
const workspace = await mkdtemp(join(tmpdir(), 'teddmhen-release-'));
const output = join(root, 'release');
await rm(output, { recursive: true, force: true });
await mkdir(output);

try {
  const source = join(workspace, 'source');
  const stage = join(workspace, name);
  await mkdir(source);
  await mkdir(stage);
  run('git', ['archive', '--format=tar', '-o', join(workspace, 'source.tar'), commit]);
  run('tar', ['-xf', join(workspace, 'source.tar'), '-C', source]);
  run('npm', ['ci', '--no-fund', '--no-audit'], source);
  run('npm', ['run', 'build'], source);
  run(process.execPath, ['scripts/check-deploy.mjs'], source);
  const wrangler = join(source, 'node_modules/wrangler/bin/wrangler.js');
  const wranglerVersion = JSON.parse(
    await readFile(join(source, 'node_modules/wrangler/package.json'), 'utf8'),
  ).version;
  run(
    process.execPath,
    [
      wrangler,
      'deploy',
      '--dry-run',
      '--outdir',
      'bundle',
      '--minify',
      '--upload-source-maps=false',
    ],
    source,
  );
  await cp(join(source, 'bundle/entry.js'), join(stage, 'worker.js'));
  await cp(join(source, 'dist'), join(stage, 'dist'), { recursive: true });
  await cp(join(source, 'migrations'), join(stage, 'migrations'), { recursive: true });
  const config = releaseConfig(parse(await readFile(join(source, 'wrangler.jsonc'), 'utf8')));
  await writeFile(join(stage, 'wrangler.json'), JSON.stringify(config, null, 2) + '\n');
  run(
    process.execPath,
    [join(source, 'scripts/check-deploy.mjs'), join(stage, 'wrangler.json')],
    stage,
  );
  await writeFile(
    join(stage, 'DEPLOY.md'),
    `# Tedd’mhen ${version}

Commit: ${commit}. Requires Node.js 22.12+ and npm. Wrangler is pinned to ${wranglerVersion}.

Verify the archive against SHA256SUMS before extraction. Review wrangler.json before deployment: it targets the owner's existing Cloudflare account and database. Another installation must replace the account/database IDs, domain and APP_ORIGIN. Never enable LOCAL_DEV in production.

From this directory, authenticate and verify the deployment without uploading:

\`\`\`sh
npx --yes wrangler@${wranglerVersion} login
npx --yes wrangler@${wranglerVersion} whoami
npx --yes wrangler@${wranglerVersion} deploy --dry-run
\`\`\`

Create a private database backup before applying migrations. Then:

\`\`\`sh
npx --yes wrangler@${wranglerVersion} d1 migrations apply DB --remote
npx --yes wrangler@${wranglerVersion} deploy
\`\`\`

No application build or source checkout is required. The Worker configuration disables rebundling and includes the AuthService migration and static assets. Credentials and account data are not included. Deployment uses your local Cloudflare credentials; the release workflow does not deploy Cloudflare or modify its database.

Follow the [operations and recovery guide](https://github.com/BloedeBleidd/Tedd-mhen/blob/${commit}/docs/DEPLOYMENT.md) for backups, Access migration, account isolation checks and rollback limitations. [Source and licensing](https://github.com/BloedeBleidd/Tedd-mhen/tree/${commit}).
`,
  );
  const files = await inventory(stage);
  await writeFile(
    join(stage, 'manifest.json'),
    JSON.stringify(
      {
        version,
        commit,
        wrangler: wranglerVersion,
        lockfileSha256: sha256(await readFile(join(source, 'package-lock.json'))),
        files,
      },
      null,
      2,
    ) + '\n',
  );
  const filename = `${name}-cloudflare.tar.gz`;
  run('tar', [
    '--sort=name',
    `--mtime=@${timestamp}`,
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-czf',
    join(output, filename),
    '-C',
    workspace,
    name,
  ]);
  const bytes = await readFile(join(output, filename));
  await writeFile(join(output, 'SHA256SUMS'), `${sha256(bytes)}  ${filename}\n`);
  await mkdir(join(output, 'package'));
  run('tar', [
    '-xzf',
    join(output, filename),
    '--strip-components=1',
    '-C',
    join(output, 'package'),
  ]);
  run(process.execPath, [wrangler, 'deploy', '--dry-run'], join(output, 'package'));
  console.log(
    `Release: ${filename}, ${(bytes.length / 1024).toFixed(0)} KiB, ${files.length + 1} files. Run npm run release:test before publication.`,
  );
} catch (error) {
  await rm(output, { recursive: true, force: true });
  throw error;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
