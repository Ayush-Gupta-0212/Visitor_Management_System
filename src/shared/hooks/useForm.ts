/**
 * A ~70-line form hook.
 *
 * Deliberately hand-written instead of pulling in a form library: the app only
 * needs values, per-field validation, touched-state and a submit guard, and
 * writing it keeps the dependency list short and the behaviour obvious.
 *
 * Validation runs on blur and on submit, never on every keystroke, so the user
 * is not told they are wrong while they are still typing.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Validator } from '@/domain/validators';
import { firstError } from '@/domain/validators';

export type FormValues = Record<string, string>;
export type FormRules<T extends FormValues> = Partial<Record<keyof T, Validator[]>>;

export interface FormApi<T extends FormValues> {
  values: T;
  errors: Partial<Record<keyof T, string | null>>;
  /** True once every rule passes - used to enable the submit button. */
  isValid: boolean;
  setValue: (field: keyof T, value: string) => void;
  /** Marks the field touched and validates it. Wire to onBlur. */
  blur: (field: keyof T) => void;
  /** Shows the error for a field only once it has been touched or submitted. */
  errorFor: (field: keyof T) => string | null;
  /** Validates everything, reveals all errors, and reports whether to proceed. */
  validateAll: () => boolean;
  reset: (next?: Partial<T>) => void;
}

export function useForm<T extends FormValues>(initial: T, rules: FormRules<T>): FormApi<T> {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const result: Partial<Record<keyof T, string | null>> = {};
    for (const field of Object.keys(values) as (keyof T)[]) {
      const fieldRules = rules[field];
      result[field] = fieldRules ? firstError(values[field], fieldRules) : null;
    }
    return result;
    // `rules` is recreated each render by callers, so it is intentionally not a
    // dependency; the rule set for a given form never changes at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const isValid = useMemo(() => Object.values(errors).every((e) => !e), [errors]);

  const setValue = useCallback((field: keyof T, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const blur = useCallback((field: keyof T) => {
    setTouched((current) => ({ ...current, [field]: true }));
  }, []);

  const errorFor = useCallback(
    (field: keyof T): string | null => {
      if (!submitted && !touched[field]) return null;
      return errors[field] ?? null;
    },
    [errors, submitted, touched],
  );

  const validateAll = useCallback(() => {
    setSubmitted(true);
    return Object.values(errors).every((e) => !e);
  }, [errors]);

  const reset = useCallback(
    (next?: Partial<T>) => {
      setValues({ ...initial, ...next });
      setTouched({});
      setSubmitted(false);
    },
    [initial],
  );

  return { values, errors, isValid, setValue, blur, errorFor, validateAll, reset };
}
