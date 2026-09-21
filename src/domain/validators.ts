/**
 * Field-level validators shared by every form.
 *
 * Deliberately hand-written rather than pulled from a schema library: the rules
 * are a dozen lines, they are easy to unit-test, and they keep the bundle small.
 * Each returns `null` when valid or an error message when not, which is exactly
 * the shape `useForm` expects.
 */

export type Validator = (value: string) => string | null;

export const required =
  (label: string): Validator =>
  (v) =>
    v.trim() ? null : `${label} is required.`;

/**
 * Indian mobile numbers: 10 digits starting 6-9, tolerating spaces, dashes and a
 * +91 prefix so the front desk can type naturally.
 */
export const phone: Validator = (v) => {
  const digits = v.replace(/[\s-()]/g, '').replace(/^\+?91/, '');
  if (!digits) return 'Mobile number is required.';
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Enter a valid 10-digit mobile number.';
  return null;
};

export const email: Validator = (v) => {
  if (!v.trim()) return null; // optional unless combined with `required`
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address.';
};

export const maxLength =
  (n: number, label: string): Validator =>
  (v) =>
    v.length <= n ? null : `${label} must be ${n} characters or fewer.`;

/** Runs validators in order and returns the first failure. */
export function firstError(value: string, validators: Validator[]): string | null {
  for (const validate of validators) {
    const message = validate(value);
    if (message) return message;
  }
  return null;
}

/** Normalises a phone number to bare digits, used as the de-duplication key. */
export function normalisePhone(v: string): string {
  return v.replace(/[\s-()]/g, '').replace(/^\+?91/, '');
}
