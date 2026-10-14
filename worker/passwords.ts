import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// OWASP's 32 MiB scrypt profile. Run only inside the AuthService Durable Object,
// whose CPU allowance accommodates deliberate password-hashing work.
const params = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, params).toString('hex');
  return `scrypt-v1:${salt}:${hash}`;
}
export function checkPassword(password: string, encoded: string | null) {
  const parts = encoded?.match(/^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{128})$/);
  // The same work is performed for absent accounts and incorrect passwords.
  const salt = parts?.[1] ?? '0'.repeat(32);
  const expected = Buffer.from(parts?.[2] ?? '0'.repeat(128), 'hex');
  const actual = scryptSync(password, salt, 64, params);
  return timingSafeEqual(actual, expected) && !!parts;
}
export function recoveryCode() {
  return `TMH-${randomBytes(32).toString('hex').toUpperCase().match(/.{8}/g)!.join('-')}`;
}
