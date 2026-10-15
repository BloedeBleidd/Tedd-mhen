import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  recoveryCodeSchema,
  validateAuthForm,
  type AuthValues,
} from '../shared/credentials';
const values: AuthValues = {
  email: 'person@example.test',
  password: 'long enough password',
  confirm: 'long enough password',
  code: `TMH-${Array(8).fill('ABCDEF12').join('-')}`,
  privacy: true,
};
describe('Credential and visible form validation', () => {
  it('enforces the same exact password boundaries without trimming or changing the password', () => {
    for (const length of [0, 8, 11, 129])
      expect(passwordSchema.safeParse('a'.repeat(length)).success).toBe(false);
    for (const length of [12, 128])
      expect(passwordSchema.parse('a'.repeat(length))).toHaveLength(length);
    expect(passwordSchema.parse('  phrase with spaces  ')).toBe('  phrase with spaces  ');
    const errors = validateAuthForm('register', {
      ...values,
      password: 'short123',
      confirm: 'short123',
    });
    expect(errors).toEqual({ password: 'Password must contain at least 12 characters.' });
    expect(JSON.stringify(errors)).not.toContain('short123');
  });
  it('identifies each invalid field in visual order and clears errors when corrected', () => {
    const errors = validateAuthForm('register', {
      ...values,
      email: 'bad',
      password: 'short',
      confirm: '',
      privacy: false,
    });
    expect(Object.keys(errors)).toEqual(['email', 'password', 'confirm', 'privacy']);
    expect(validateAuthForm('register', { ...values, confirm: 'different password' })).toEqual({
      confirm: 'Passwords do not match.',
    });
    expect(validateAuthForm('register', values)).toEqual({});
    expect(emailSchema.parse(' Person@Example.test ')).toBe('person@example.test');
    expect(emailSchema.safeParse('a'.repeat(250) + '@example.test').success).toBe(false);
  });
  it('applies new-password rules to recovery and claim, while login accepts existing short passwords', () => {
    expect(validateAuthForm('claim', { ...values, email: '', code: '', privacy: false })).toEqual(
      {},
    );
    expect(validateAuthForm('claim', { ...values, password: 'short' }).password).toContain('12');
    expect(validateAuthForm('recover', { ...values, code: '', password: 'short' })).toMatchObject({
      code: expect.stringContaining('complete recovery code'),
      password: expect.stringContaining('12'),
    });
    expect(
      validateAuthForm('login', {
        ...values,
        password: 'short',
        confirm: '',
        code: '',
        privacy: false,
      }),
    ).toEqual({});
    expect(validateAuthForm('login', { ...values, password: '' })).toEqual({
      password: 'Enter your password.',
    });
  });
  it('validates the entire recovery-code format and preserves the server normalization', () => {
    expect(recoveryCodeSchema.parse(` ${values.code.toLowerCase()} `)).toBe(values.code);
    for (const code of [
      '',
      'TMH-short',
      values.code.slice(0, -1),
      values.code + '-ABCDEF12',
      values.code.replace('A', 'G'),
    ])
      expect(recoveryCodeSchema.safeParse(code).success).toBe(false);
    expect(validateAuthForm('recover', { ...values, privacy: false })).toEqual({});
  });
});
