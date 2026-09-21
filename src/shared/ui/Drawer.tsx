/**
 * A right-hand side panel, used for the Guest Details view in the wireframe.
 *
 * Accessibility is the whole reason this is a component rather than a div:
 *
 *   - it is a labelled `role="dialog"` with `aria-modal`;
 *   - focus moves into the panel when it opens and returns to whatever was
 *     focused when it closes;
 *   - Tab is trapped inside the panel, so keyboard users cannot wander into the
 *     table behind it;
 *   - Escape closes it.
 *
 * On narrow screens it becomes a full-width sheet instead of a side panel.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Rendered next to the title, e.g. the OVERSTAY badge. */
  titleAdornment?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({ open, onClose, title, titleAdornment, footer, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      // Wrap focus around the ends of the panel.
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-ink/20 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-xl sm:max-w-md lg:static lg:z-auto lg:w-[26rem] lg:shadow-none"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {titleAdornment}
          <button
            onClick={onClose}
            aria-label="Close details"
            className="ml-auto rounded-md p-1 text-2xl leading-none text-muted hover:bg-canvas hover:text-ink"
          >
            &times;
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </>
  );
}
