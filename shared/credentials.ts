import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254, 'Email must contain at most 254 characters.');
export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(128, 'Password must contain at most 128 characters.');
export const loginPassword = z
  .string()
  .min(1, 'Enter your password.')
  .max(128, 'Password must contain at most 128 characters.');
export const recoveryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^TMH-(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/,
    'Enter your complete recovery code, starting with TMH-.',
  );

export type AuthMode = 'register' | 'login' | 'recover' | 'claim';
export type AuthField = 'email' | 'code' | 'password' | 'confirm' | 'privacy';
export type AuthValues = {
  email: string;
  code: string;
  password: string;
  confirm: string;
  privacy: boolean;
};
export function validateAuthForm(
  mode: AuthMode,
  values: AuthValues,
): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};
  const check = (field: AuthField, schema: z.ZodType, value: unknown) => {
    const result = schema.safeParse(value);
    if (!result.success) errors[field] = result.error.issues[0].message;
  };
  if (mode !== 'claim') check('email', emailSchema, values.email);
  if (mode === 'recover') check('code', recoveryCodeSchema, values.code);
  check('password', mode === 'login' ? loginPassword : passwordSchema, values.password);
  if (mode !== 'login') {
    if (!values.confirm) errors.confirm = 'Re-enter your new password.';
    else if (values.password !== values.confirm) errors.confirm = 'Passwords do not match.';
  }
  if (mode === 'register' && !values.privacy)
    errors.privacy = 'Read Privacy & data and tick the acknowledgement to continue.';
  return errors;
}
