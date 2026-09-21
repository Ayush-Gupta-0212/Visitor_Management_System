/**
 * The small, unopinionated building blocks every screen is assembled from.
 *
 * Keeping them here means spacing, focus rings, disabled styling and the
 * label/error/description wiring are defined once. Each form control renders a
 * real `<label>` tied to its input by id, and announces its error through
 * `aria-describedby` + `aria-invalid`, so the whole app is usable with a screen
 * reader without any screen having to think about it.
 */
import { useId } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  block?: boolean;
}

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:bg-line disabled:text-muted',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas disabled:text-muted',
  ghost: 'bg-transparent text-muted hover:bg-canvas hover:text-ink',
  danger: 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white',
};

export function Button({
  variant = 'secondary',
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold',
        'transition-colors disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/* -------------------------------- Field ------------------------------- */

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/**
 * Shared label/error chrome. Using a render prop keeps the accessibility wiring
 * in one place while letting each control stay a plain DOM element.
 */
function FieldShell({ label, required, error, hint, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="text-danger" aria-hidden="true">
              {' '}
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>

      {children({ id, describedBy: invalid ? errorId : undefined, invalid })}

      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-colors';

function controlClass(invalid: boolean): string {
  return `${CONTROL_BASE} ${invalid ? 'border-danger' : 'border-line hover:border-muted/50'}`;
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function Input({ label, error, hint, required, ...rest }: InputProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={controlClass(invalid)}
        />
      )}
    </FieldShell>
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string | null;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, required, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} required={required} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={controlClass(invalid)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | null;
  /** Shows a live "123/1000" counter, as in the reference wireframe. */
  counterMax?: number;
}

export function Textarea({ label, error, counterMax, required, value, ...rest }: TextareaProps) {
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={counterMax ? `${length}/${counterMax}` : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          value={value}
          required={required}
          maxLength={counterMax}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${controlClass(invalid)} min-h-24 resize-y`}
        />
      )}
    </FieldShell>
  );
}

/* -------------------------------- Badge ------------------------------- */

export type BadgeTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-canvas text-muted border-line',
  brand: 'bg-brand-soft text-brand border-brand/20',
  ok: 'bg-ok-soft text-ok border-ok/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${BADGE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Avatar ------------------------------- */

/** Initials avatar, as used for the "Added guests" list in the wireframe. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join(' ');

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand"
    >
      {initials}
    </span>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>
  );
}
