/**
 * A rule violation that the user is allowed to see.
 *
 * Splitting "expected" domain failures from genuine bugs matters for the UI: a
 * DomainError is rendered verbatim in a toast or next to a form field, whereas an
 * unknown Error is swallowed by the error boundary and shown as a generic
 * "Something went wrong" (never leak stack traces to end users).
 */
export class DomainError extends Error {
  /** Machine-readable code, handy for tests and for mapping to a field. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

/** Type guard: narrows `unknown` (what `catch` gives you) to `DomainError`. */
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

/** Turns anything thrown into a message safe to display. */
export function toUserMessage(e: unknown): string {
  if (isDomainError(e)) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong. Please try again.';
}
