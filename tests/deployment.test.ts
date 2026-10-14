import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function check(contents: string) {
  const directory = mkdtempSync(join(tmpdir(), 'teddmhen-deploy-test-'));
  try {
    const file = join(directory, 'wrangler.jsonc');
    writeFileSync(file, contents);
    return spawnSync(process.execPath, ['scripts/check-deploy.mjs', file], { encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const configured = {
  d1_databases: [{ binding: 'DB', database_id: '11111111-2222-3333-4444-555555555555' }],
  routes: [{ pattern: 'teddmhen.piotrzmudadev.com', custom_domain: true }],
  vars: {
    APP_ORIGIN: 'https://teddmhen.piotrzmudadev.com',
    ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com',
    ACCESS_AUD: 'test-audience',
  },
  compatibility_flags: ['nodejs_compat'],
  durable_objects: { bindings: [{ name: 'AUTH', class_name: 'AuthService' }] },
  migrations: [{ tag: 'v1-auth', new_sqlite_classes: ['AuthService'] }],
  workers_dev: false,
  preview_urls: false,
};

describe('Deployment configuration gate', () => {
  it('accepts valid JSONC comments and formatter-added trailing commas', () => {
    const jsonc = JSON.stringify(configured, null, 2).replace(/}\s*$/, ',\n}');
    const result = check(`// Production deployment configuration\n${jsonc}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Deployment configuration is complete.');
  });

  it('rejects malformed input instead of accepting the fault-tolerant parser result', () => {
    const result = check(JSON.stringify(configured).slice(0, -1));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid Wrangler configuration');
  });

  it('blocks deployment until the database and application origin are configured', () => {
    const result = check(
      JSON.stringify({
        ...configured,
        d1_databases: [{ binding: 'DB', database_id: '00000000-0000-0000-0000-000000000000' }],
        vars: {},
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Set the database_id');
    expect(result.stderr).toContain('Set APP_ORIGIN');
  });
  it('rejects missing account runtime configuration', () => {
    const result = check(
      JSON.stringify({
        ...configured,
        durable_objects: {},
        migrations: [],
        compatibility_flags: [],
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Bind AUTH');
    expect(result.stderr).toContain('SQLite AuthService');
    expect(result.stderr).toContain('nodejs_compat');
  });

  it('rejects local authentication bypass and alternate production endpoints', () => {
    const result = check(
      JSON.stringify({
        ...configured,
        vars: { ...configured.vars, LOCAL_DEV: 'true' },
        workers_dev: true,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Remove LOCAL_DEV');
    expect(result.stderr).toContain('Disable workers.dev');
  });
});
