import { DurableObject } from 'cloudflare:workers';
import { handleAccount } from './accounts';
import type { Env } from './auth';

export class AuthService extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)',
    );
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS attempts_expiry ON attempts(expires)');
  }
  async fetch(request: Request) {
    return handleAccount(request, this.env, async (key, maximum) => {
      const now = Date.now();
      this.ctx.storage.sql.exec('DELETE FROM attempts WHERE expires <= ?', now);
      const row = this.ctx.storage.sql
        .exec<{ count: number }>(
          'INSERT INTO attempts(key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count',
          key,
          now + 600000,
        )
        .one();
      return row.count <= maximum;
    });
  }
}
