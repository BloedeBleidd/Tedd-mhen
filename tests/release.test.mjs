import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allowedReleaseFile,
  inventory,
  releaseConfig,
  releaseIdentity,
  sha256,
} from '../scripts/release-files.mjs';

const directories = [];
async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'teddmhen-release-test-'));
  directories.push(directory);
  return directory;
}
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('Release provenance and file boundary', () => {
  it('requires a numeric version, full commit and matching release tag', () => {
    const commit = 'a'.repeat(40);
    expect(releaseIdentity('0.1.0', commit, 'v0.1.0')).toBe('teddmhen-0.1.0');
    expect(releaseIdentity('2.10.3', commit)).toBe('teddmhen-2.10.3');
    expect(() => releaseIdentity('../0.1.0', commit)).toThrow('version');
    expect(() => releaseIdentity('01.0.0', commit)).toThrow('version');
    expect(() => releaseIdentity('0.1.0', 'a'.repeat(7))).toThrow('commit');
    expect(() => releaseIdentity('0.1.0', commit, 'v0.2.0')).toThrow('tag');
  });

  it('allows deployable assets and SQL, excluding source, private data and diagnostics', () => {
    for (const path of [
      'worker.js',
      'dist/index.html',
      'dist/_headers',
      'dist/assets/worker-abc_123.js',
      'dist/assets/index-A1.css',
      'migrations/0003_administrators.sql',
    ])
      expect(allowedReleaseFile(path), path).toBe(true);
    for (const path of [
      '.env.cloudflare',
      '.dev.vars',
      'dist/.env',
      'dist/records.json',
      'dist/assets/app.js.map',
      'dist/assets/../../secret.js',
      'dist/assets/app.js/secret',
      'backups/data.sql',
      '.wrangler/state/db.sqlite',
      'test-results/screenshot.png',
      'src/App.tsx',
      'node_modules/react/index.js',
      'migrations/records.sql',
    ])
      expect(allowedReleaseFile(path), path).toBe(false);
  });

  it('records exact byte counts and independently known SHA-256 digests in stable path order', async () => {
    const directory = await temporaryDirectory();
    await mkdir(join(directory, 'dist'));
    await writeFile(join(directory, 'worker.js'), 'abc');
    await writeFile(join(directory, 'dist/index.html'), '');
    expect(await inventory(directory)).toEqual([
      {
        path: 'dist/index.html',
        bytes: 0,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      {
        path: 'worker.js',
        bytes: 3,
        sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      },
    ]);
    expect(sha256(Buffer.from('abd'))).not.toBe(sha256(Buffer.from('abc')));
  });

  it('fails closed on an unexpected file instead of quietly including it', async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, '.env.cloudflare'), 'synthetic-fixture-only');
    await expect(inventory(directory)).rejects.toThrow('Unexpected release file');
  });

  it('rejects symlinks even when the link name is an allowed file or directory', async () => {
    const target = await temporaryDirectory();
    await writeFile(join(target, 'private'), 'synthetic-fixture-only');
    for (const [name, destination] of [
      ['worker.js', join(target, 'private')],
      ['dist', target],
    ]) {
      const directory = await temporaryDirectory();
      await symlink(destination, join(directory, name));
      await expect(inventory(directory)).rejects.toThrow('Symlinks');
    }
  });

  it('preserves production bindings while replacing build paths and excluding unrelated configuration', () => {
    const config = {
      main: 'worker/entry.ts',
      name: 'teddmhen',
      workers_dev: false,
      preview_urls: false,
      compatibility_flags: ['nodejs_compat'],
      compatibility_date: '2026-10-01',
      durable_objects: { bindings: [{ name: 'AUTH', class_name: 'AuthService' }] },
      migrations: [{ tag: 'v1-auth', new_sqlite_classes: ['AuthService'] }],
      assets: { directory: './dist', binding: 'ASSETS', run_worker_first: ['/api', '/api/*'] },
      d1_databases: [{ binding: 'DB', database_id: 'database-id', migrations_dir: 'migrations' }],
      vars: { APP_ORIGIN: 'https://example.test' },
      build: { command: 'must not execute' },
      dev: { port: 8787 },
    };
    const output = releaseConfig(config);
    expect(output.main).toBe('worker.js');
    expect(output.no_bundle).toBe(true);
    expect(output.upload_source_maps).toBe(false);
    for (const key of [
      'durable_objects',
      'migrations',
      'assets',
      'd1_databases',
      'vars',
      'compatibility_flags',
    ])
      expect(output[key]).toEqual(config[key]);
    expect(output.build).toBeUndefined();
    expect(output.dev).toBeUndefined();
    expect(config.main).toBe('worker/entry.ts');
    output.assets.directory = 'changed';
    expect(config.assets.directory).toBe('./dist');
    expect(() => releaseConfig({ ...config, vars: { ...config.vars, LOCAL_DEV: 'true' } })).toThrow(
      'variables',
    );
    expect(() =>
      releaseConfig({ ...config, vars: { ...config.vars, API_TOKEN: 'synthetic' } }),
    ).toThrow('variables');
  });
});
