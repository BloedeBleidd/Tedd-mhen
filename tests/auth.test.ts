import { describe, expect, it } from 'vitest';
import { authenticate, isLocal, verifyAccessToken, type Env } from '../worker/auth';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
const env = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '' } as Env;
describe('Fail-closed authentication', () => {
  it('verifies signatures and rejects wrong audience, issuer, expiry and missing identity', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwks = createLocalJWKSet({
      keys: [{ ...(await exportJWK(publicKey)), alg: 'RS256', kid: 'test-key' }],
    });
    const issuer = 'https://test.cloudflareaccess.com';
    const sign = (
      audience: string,
      tokenIssuer = issuer,
      expiration: string | number = '5m',
      email: string | undefined = 'owner@example.test',
    ) =>
      new SignJWT({ email })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setSubject('owner')
        .setIssuer(tokenIssuer)
        .setAudience(audience)
        .setExpirationTime(expiration)
        .sign(privateKey);
    await expect(verifyAccessToken(await sign('app'), issuer, 'app', jwks)).resolves.toEqual({
      id: 'owner',
      email: 'owner@example.test',
    });
    await expect(verifyAccessToken(await sign('wrong'), issuer, 'app', jwks)).rejects.toThrow();
    await expect(
      verifyAccessToken(await sign('app', 'https://evil.test'), issuer, 'app', jwks),
    ).rejects.toThrow();
    await expect(
      verifyAccessToken(await sign('app', issuer, 1), issuer, 'app', jwks),
    ).rejects.toThrow();
    await expect(
      verifyAccessToken(await sign('app', issuer, '5m', ''), issuer, 'app', jwks),
    ).rejects.toThrow();
    const token = await sign('app');
    const parts = token.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({
        sub: 'attacker',
        email: 'attacker@example.test',
        iss: issuer,
        aud: 'app',
        exp: 9999999999,
      }),
    ).toString('base64url');
    await expect(verifyAccessToken(parts.join('.'), issuer, 'app', jwks)).rejects.toThrow();
  });
  it('does not grant unauthenticated production access when configuration is missing', async () => {
    await expect(
      authenticate(new Request('https://journal.example/api/session'), env),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('requires a token when production Access is configured', async () => {
    await expect(
      authenticate(new Request('https://journal.example/api/session'), {
        ...env,
        ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com',
        ACCESS_AUD: 'audience',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('does not accept an email header as identity or an unverified JWT', async () => {
    const request = new Request('https://journal.example/api/session', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'attacker@example.test',
        'Cf-Access-Jwt-Assertion': 'forged',
      },
    });
    await expect(
      authenticate(request, {
        ...env,
        ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com',
        ACCESS_AUD: 'audience',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('requires both explicit local mode and a loopback host for bypass', async () => {
    expect(isLocal(new Request('https://journal.example'), { ...env, LOCAL_DEV: 'true' })).toBe(
      false,
    );
    expect(isLocal(new Request('http://127.0.0.1:8787'), env)).toBe(false);
    expect(isLocal(new Request('http://localhost.evil.test'), { ...env, LOCAL_DEV: 'true' })).toBe(
      false,
    );
    await expect(
      authenticate(new Request('http://127.0.0.1:8787/api/session'), { ...env, LOCAL_DEV: 'true' }),
    ).resolves.toMatchObject({ id: 'local-developer' });
  });
});
