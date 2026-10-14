import { describe, expect, it } from 'vitest';
import { hashPassword, checkPassword, recoveryCode } from '../worker/passwords';
import { cookieHeader, digest, sessionToken } from '../worker/sessions';
describe('Credential primitives', () => {
  it('salts password hashes independently and verifies exact Unicode passwords', () => {
    const password = 'A long synthetic passphrase żółw 🌙';
    const a = hashPassword(password),
      b = hashPassword(password);
    expect(a).not.toBe(b);
    expect(a).not.toContain(password);
    expect(checkPassword(password, a)).toBe(true);
    expect(checkPassword(password + 'x', a)).toBe(false);
    expect(checkPassword(password, null)).toBe(false);
  });
  it('generates independent recovery secrets and stores only their digests', async () => {
    const a = recoveryCode(),
      b = recoveryCode();
    expect(a).toMatch(/^TMH-(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/);
    expect(a).not.toBe(b);
    expect(await digest(a)).toHaveLength(64);
    expect(await digest(a)).not.toContain(a);
  });
  it('uses secure host-only production cookies and rejects malformed or insecure names', () => {
    const request = new Request('https://journal.example');
    expect(cookieHeader(request, 'a'.repeat(64))).toContain('__Host-teddmhen_session=');
    expect(cookieHeader(request, '')).toContain('Path=/; HttpOnly; SameSite=Lax;');
    expect(cookieHeader(request, '')).toContain('; Secure');
    expect(
      sessionToken(
        new Request(request, { headers: { Cookie: 'teddmhen_session=' + 'a'.repeat(64) } }),
      ),
    ).toBeNull();
    expect(
      sessionToken(new Request(request, { headers: { Cookie: '__Host-teddmhen_session=forged' } })),
    ).toBeNull();
  });
});
