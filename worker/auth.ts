import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { readSession, sessionToken } from './sessions';
export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  LOCAL_DEV?: string;
  AUTH: DurableObjectNamespace;
  APP_ORIGIN: string;
};
export const isLocal = (request: Request, env: Env) =>
  env.LOCAL_DEV === 'true' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyAccessToken(
  token: string,
  issuer: string,
  audience: string,
  keySet: JWTVerifyGetKey,
) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'email'],
  });
  if (!payload.sub || typeof payload.email !== 'string' || !payload.email)
    throw new Error('Identity missing');
  return { id: payload.sub, email: payload.email };
}
export async function authenticateLegacy(
  request: Request,
  env: Env,
): Promise<{ id: string; email: string }> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD)
    throw new Response(
      JSON.stringify({
        error: 'Private access is not configured. Complete the Cloudflare Access setup.',
      }),
      { status: 503 },
    );
  const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))
    throw new Response(JSON.stringify({ error: 'Invalid access configuration.' }), { status: 503 });
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token)
    throw new Response(JSON.stringify({ error: 'Sign in through Cloudflare Access.' }), {
      status: 401,
    });
  const issuer = `https://${domain}`;
  if (!keys.has(issuer))
    keys.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
  try {
    return await verifyAccessToken(token, issuer, env.ACCESS_AUD, keys.get(issuer)!);
  } catch {
    throw new Response(
      JSON.stringify({ error: 'Your session could not be verified. Sign in again.' }),
      { status: 401 },
    );
  }
}

export async function authenticate(
  request: Request,
  env: Env,
): Promise<{ id: string; email: string }> {
  if (sessionToken(request)) {
    const user = await readSession(request, env.DB);
    if (user) return user;
  } else if (isLocal(request, env)) return { id: 'local-developer', email: 'local@teddmhen.test' };
  throw new Response(JSON.stringify({ error: 'Sign in to access your journal.' }), { status: 401 });
}
