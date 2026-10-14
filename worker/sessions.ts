export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function sessionCookieName(request: Request) {
  return new URL(request.url).protocol === 'https:'
    ? '__Host-teddmhen_session'
    : 'teddmhen_session';
}
export function sessionToken(request: Request) {
  const name = sessionCookieName(request);
  const token = request.headers
    .get('Cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export function cookieHeader(request: Request, token: string, clear = false) {
  return `${sessionCookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function readSession(request: Request, db: D1Database) {
  const token = sessionToken(request);
  if (!token) return null;
  return db
    .prepare(
      `SELECT a.user_id AS id, a.email, a.version FROM auth_sessions s
    JOIN auth_accounts a ON a.user_id = s.user_id AND a.version = s.account_version
    WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await digest(token), Date.now())
    .first<{ id: string; email: string; version: number }>();
}
