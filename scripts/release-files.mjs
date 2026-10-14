import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function releaseIdentity(version, commit, tag) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error('Release version must be a numeric major.minor.patch.');
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Release requires a full Git commit ID.');
  if (tag && tag !== `v${version}`) throw new Error('Release tag must match package.json version.');
  return `teddmhen-${version}`;
}

export function allowedReleaseFile(path) {
  return (
    [
      'worker.js',
      'wrangler.json',
      'DEPLOY.md',
      'dist/index.html',
      'dist/favicon.svg',
      'dist/_headers',
    ].includes(path) ||
    /^dist\/assets\/[A-Za-z0-9_-]+\.(js|css|svg|woff2?|png|webp|avif|jpg)$/.test(path) ||
    /^migrations\/\d{4}_[a-z0-9_]+\.sql$/.test(path)
  );
}

export async function inventory(directory, prefix = '') {
  const result = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = prefix ? `${prefix}/${name}` : name;
    const absolute = join(directory, name);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink())
      throw new Error(`Symlinks are not allowed in release files: ${path}`);
    if (stat.isDirectory()) result.push(...(await inventory(absolute, path)));
    else if (stat.isFile()) {
      if (!allowedReleaseFile(path)) throw new Error(`Unexpected release file: ${path}`);
      const bytes = await readFile(absolute);
      result.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
    } else throw new Error(`Unsupported release file: ${path}`);
  }
  return result;
}

export function releaseConfig(config) {
  const keys = [
    'name',
    'account_id',
    'compatibility_date',
    'compatibility_flags',
    'workers_dev',
    'preview_urls',
    'durable_objects',
    'migrations',
    'routes',
    'assets',
    'd1_databases',
    'vars',
  ];
  const permittedVars = ['APP_ORIGIN', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD'];
  if (Object.keys(config.vars ?? {}).some((key) => !permittedVars.includes(key)))
    throw new Error('Review new Worker variables before including them in a public release.');
  const result = structuredClone(
    Object.fromEntries(keys.filter((key) => key in config).map((key) => [key, config[key]])),
  );
  result.main = 'worker.js';
  result.no_bundle = true;
  result.upload_source_maps = false;
  result.assets.directory = './dist';
  for (const database of result.d1_databases) database.migrations_dir = 'migrations';
  return result;
}
