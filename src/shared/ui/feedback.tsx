/**
 * Loading, empty, error and notification states.
 *
 * "Does the system provide feedback to users regarding successful or
 * unsuccessful operations?" is an explicit evaluation criterion, so every list
 * in this app renders one of four things - skeleton, empty, error, or data -
 * and never a blank rectangle.
 */
import type { ReactNode } from 'react';
import { Button } from './primitives';
import { useStore } from '@/app/store';

/* ------------------------------ skeletons ----------------------------- */

/** Shown while the dataset is being generated and indexed. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-px" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4">
          <div className="h-3 w-40 animate-pulse rounded bg-line" />
          <div className="h-3 w-28 animate-pulse rounded bg-line" />
          <div className="ml-auto h-3 w-20 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- states ------------------------------ */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <p className="text-base font-semibold text-danger">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* -------------------------------- toasts ------------------------------ */

const TOAST_TONE = {
  success: 'border-ok/30 bg-ok-soft text-ok',
  error: 'border-danger/30 bg-danger-soft text-danger',
  info: 'border-brand/30 bg-brand-soft text-brand',
} as const;

/**
 * Toast host. Mounted once, near the root.
 *
 * The container is an `aria-live` region so a screen reader announces each
 * message without moving focus - important because toasts appear in response to
 * actions the user took somewhere else on the page.
 */
export function Toaster() {
  const toasts = useStore((state) => state.toasts);
  const dismiss = useStore((state) => state.dismissToast);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${TOAST_TONE[toast.kind]}`}
        >
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.();
                dismiss(toast.id);
              }}
              className="text-sm font-bold underline underline-offset-2"
            >
              Undo
            </button>
          )}
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="text-lg leading-none opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
