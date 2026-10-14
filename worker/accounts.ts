import { z } from 'zod';
import { checkPassword, hashPassword, recoveryCode } from './passwords';
import {
  cookieHeader,
  digest,
  randomToken,
  readSession,
  SESSION_SECONDS,
  sessionToken,
} from './sessions';

export type AccountEnv = { DB: D1Database };
type Account = {
  user_id: string;
  email: string;
  password_hash: string;
  recovery_hash: string;
  version: number;
};
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.');
const loginPassword = z.string().min(1).max(128);
const credentials = z.object({ email: emailSchema, password: passwordSchema }).strict();
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } });
const fail = (message: string, status = 400): never => {
  throw json({ error: message }, status);
};

async function readInput(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    fail('Use a JSON request.', 415);
  const reader = request.body?.getReader();
  if (!reader) fail('Missing request body.');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 8192) {
      await reader!.cancel();
      fail('Request is too large.', 413);
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    fail('Invalid JSON.');
  }
}

async function createSession(
  request: Request,
  db: D1Database,
  account: { user_id: string; version: number },
  extra: object = {},
) {
  const token = randomToken();
  await db.batch([
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(Date.now()),
    db
      .prepare(
        'INSERT INTO auth_sessions(token_hash, user_id, account_version, expires_at) VALUES (?, ?, ?, ?)',
      )
      .bind(
        await digest(token),
        account.user_id,
        account.version,
        Date.now() + SESSION_SECONDS * 1000,
      ),
  ]);
  return json({ ok: true, ...extra }, 200, { 'Set-Cookie': cookieHeader(request, token) });
}

export async function handleAccount(
  request: Request,
  env: AccountEnv,
  limit: (key: string, maximum: number) => Promise<boolean>,
) {
  try {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (
      request.headers.get('Origin') !== url.origin ||
      request.headers.get('X-Teddmhen-Request') !== '1'
    )
      fail('Cross-origin or unverified requests are not allowed.', 403);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (!(await limit(`ip:${await digest(ip)}`, 30)))
      return json({ error: 'Too many attempts. Try again in 10 minutes.' }, 429, {
        'Retry-After': '600',
      });
    const body = await readInput(request);
    const action = url.pathname.split('/').pop();
    if (action === 'logout') {
      const token = sessionToken(request);
      if (token)
        await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
          .bind(await digest(token))
          .run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, '', true) });
    }
    if (action === 'register' || action === 'claim') {
      const legacyId = request.headers.get('X-Legacy-Id');
      const legacyEmail = request.headers.get('X-Legacy-Email');
      if (action === 'claim' && (!legacyId || !legacyEmail))
        fail('Verify your existing owner identity first.', 403);
      const input =
        action === 'claim'
          ? credentials.parse({
              email: legacyEmail,
              password: z.object({ password: passwordSchema }).strict().parse(body).password,
            })
          : credentials.parse(body);
      const existing = await env.DB.prepare('SELECT user_id FROM auth_accounts WHERE email = ?')
        .bind(input.email)
        .first();
      const reserved = await env.DB.prepare(
        'SELECT email, user_id FROM auth_legacy_reservations WHERE email = ?',
      )
        .bind(input.email)
        .first<{ email: string; user_id: string | null }>();
      if (action === 'claim' && reserved?.user_id && reserved.user_id !== legacyId)
        fail(
          'Your legacy identity does not match the existing journal. Contact the maintainer.',
          409,
        );
      if (existing || (action === 'register' && reserved))
        fail(
          'This email cannot be registered. Try signing in or recovering your account. Existing owners should use the migration link.',
          409,
        );
      const id = action === 'claim' ? legacyId! : crypto.randomUUID();
      const code = recoveryCode();
      const passwordHash = hashPassword(input.password);
      try {
        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO users(id, email) VALUES (?, ?) ON CONFLICT(id) DO NOTHING',
          ).bind(id, input.email),
          env.DB.prepare(
            'INSERT INTO auth_accounts(user_id, email, password_hash, recovery_hash) VALUES (?, ?, ?, ?)',
          ).bind(id, input.email, passwordHash, await digest(code)),
          env.DB.prepare('DELETE FROM auth_legacy_reservations WHERE email = ?').bind(input.email),
        ]);
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint/i.test(error.message))
          fail('This email cannot be registered. Try signing in instead.', 409);
        throw error;
      }
      return createSession(request, env.DB, { user_id: id, version: 1 }, { recoveryCode: code });
    }
    if (action === 'login' || action === 'recover') {
      const input: { email: string; password: string; code?: string } =
        action === 'login'
          ? z.object({ email: emailSchema, password: loginPassword }).strict().parse(body)
          : z
              .object({
                email: emailSchema,
                password: passwordSchema,
                code: z
                  .string()
                  .trim()
                  .toUpperCase()
                  .regex(/^TMH-(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/),
              })
              .strict()
              .parse(body);
      if (!(await limit(`email:${await digest(input.email)}`, 10)))
        return json({ error: 'Too many attempts. Try again in 10 minutes.' }, 429, {
          'Retry-After': '600',
        });
      const account = await env.DB.prepare('SELECT * FROM auth_accounts WHERE email = ?')
        .bind(input.email)
        .first<Account>();
      if (action === 'login') {
        if (!checkPassword(input.password, account?.password_hash ?? null) || !account)
          fail('Email or password is incorrect.', 401);
        return createSession(request, env.DB, account!);
      }
      const supplied = await digest(input.code!);
      if (!account || supplied !== account.recovery_hash)
        fail('Email or recovery code is incorrect.', 401);
      const code = recoveryCode();
      const result = await env.DB.prepare(
        'UPDATE auth_accounts SET password_hash = ?, recovery_hash = ?, version = version + 1 WHERE user_id = ? AND recovery_hash = ? AND version = ?',
      )
        .bind(
          hashPassword(input.password),
          await digest(code),
          account!.user_id,
          supplied,
          account!.version,
        )
        .run();
      if (!result.meta.changes) fail('This recovery code has already been used.', 409);
      // Changing the account version atomically invalidates all previous sessions.
      return createSession(
        request,
        env.DB,
        { user_id: account!.user_id, version: account!.version + 1 },
        { recoveryCode: code },
      );
    }
    if (action === 'change-password' || action === 'delete-account') {
      const user = await readSession(request, env.DB);
      if (!user) fail('Sign in to continue.', 401);
      const input: { currentPassword: string; password?: string } =
        action === 'change-password'
          ? z
              .object({ currentPassword: loginPassword, password: passwordSchema })
              .strict()
              .parse(body)
          : z.object({ currentPassword: loginPassword }).strict().parse(body);
      const account = await env.DB.prepare('SELECT * FROM auth_accounts WHERE user_id = ?')
        .bind(user!.id)
        .first<Account>();
      if (!account || !checkPassword(input.currentPassword, account.password_hash))
        fail('Current password is incorrect.', 401);
      if (action === 'delete-account') {
        // The password version guard prevents deletion after concurrent credential rotation.
        const result = await env.DB.batch([
          env.DB.prepare(
            'DELETE FROM entries WHERE owner_id = ? AND EXISTS (SELECT 1 FROM auth_accounts WHERE user_id = ? AND version = ?)',
          ).bind(user!.id, user!.id, user!.version),
          env.DB.prepare('DELETE FROM auth_accounts WHERE user_id = ? AND version = ?').bind(
            user!.id,
            user!.version,
          ),
          env.DB.prepare(
            'DELETE FROM users WHERE id = ? AND NOT EXISTS (SELECT 1 FROM auth_accounts WHERE user_id = ?)',
          ).bind(user!.id, user!.id),
        ]);
        if (!result[1].meta.changes) fail('Your account changed. Sign in again.', 409);
        return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, '', true) });
      }
      const code = recoveryCode();
      const result = await env.DB.prepare(
        'UPDATE auth_accounts SET password_hash = ?, recovery_hash = ?, version = version + 1 WHERE user_id = ? AND version = ?',
      )
        .bind(hashPassword(input.password!), await digest(code), user!.id, user!.version)
        .run();
      if (!result.meta.changes) fail('Your account changed. Sign in again.', 409);
      return createSession(
        request,
        env.DB,
        { user_id: user!.id, version: user!.version + 1 },
        { recoveryCode: code },
      );
    }
    return json({ error: 'Endpoint not found.' }, 404);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError)
      return json({ error: error.issues.map((issue) => issue.message).join(' ') }, 400);
    // Never log credential bodies, session tokens, recovery codes, or email addresses.
    console.error('Account operation failed', {
      category: error instanceof Error ? error.name : 'unknown',
    });
    return json({ error: 'Could not complete this account operation. Try again.' }, 500);
  }
}
