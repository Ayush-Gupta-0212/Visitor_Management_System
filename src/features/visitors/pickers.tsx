/**
 * Type-ahead pickers for hosts and guests.
 *
 * Both are backed by the same inverted prefix index that powers the visitor
 * table's search, so a lookup stays O(candidates) no matter how many employees
 * or past visitors exist.
 *
 * Keyboard support is not optional here: the front desk works at speed, often
 * without touching the mouse. Arrow keys move through the results, Enter picks
 * the highlighted one, Escape closes the list.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { visitIndex } from '@/app/store';

import { Avatar } from '@/shared/ui/primitives';
import { useDebounced } from '@/shared/hooks';

/* ------------------------------ host picker --------------------------- */

interface HostPickerProps {
  value: string;
  onChange: (employeeId: string) => void;
  error?: string | null;
}

export function HostPicker({ value, onChange, error }: HostPickerProps) {
  const selected = value ? visitIndex.employees.get(value) : undefined;
  const [text, setText] = useState('');
  const debounced = useDebounced(text, 150);

  const results = useMemo(() => visitIndex.searchEmployees(debounced), [debounced]);

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          Host employee <span className="text-danger">*</span>
        </span>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2">
          <Avatar name={selected.name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{selected.name}</p>
            <p className="truncate text-xs text-muted">
              {selected.department} · {selected.email}
            </p>
          </div>
          <button
            onClick={() => {
              onChange('');
              setText('');
            }}
            className="text-sm font-semibold text-brand underline underline-offset-2"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <Combobox
      label="Host employee"
      required
      placeholder="Search by name, email or department"
      text={text}
      onText={setText}
      error={error}
      results={results}
      getKey={(employee) => employee.id}
      onPick={(employee) => {
        onChange(employee.id);
        setText('');
      }}
      renderItem={(employee) => (
        <>
          <Avatar name={employee.name} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{employee.name}</span>
            <span className="block truncate text-xs text-muted">
              {employee.department} · {employee.email}
            </span>
          </span>
        </>
      )}
    />
  );
}

/* ----------------------------- guest picker --------------------------- */

interface GuestPickerProps {
  selectedIds: string[];
  onAdd: (visitorId: string) => void;
  onRemove: (visitorId: string) => void;
}

/** The "search + Added guests" pane from the invite wireframe. */
export function GuestPicker({ selectedIds, onAdd, onRemove }: GuestPickerProps) {
  const [text, setText] = useState('');
  const debounced = useDebounced(text, 150);

  const results = useMemo(
    () => visitIndex.searchVisitors(debounced).filter((v) => !selectedIds.includes(v.id)),
    [debounced, selectedIds],
  );

  return (
    <div className="flex flex-col gap-4">
      <Combobox
        label="Search guests"
        required={selectedIds.length === 0}
        placeholder="Search by name, id, email or phone"
        text={text}
        onText={setText}
        results={results}
        getKey={(visitor) => visitor.id}
        onPick={(visitor) => {
          onAdd(visitor.id);
          setText('');
        }}
        renderItem={(visitor) => (
          <>
            <Avatar name={visitor.fullName} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {visitor.fullName}
              </span>
              <span className="block truncate text-xs text-muted">
                {visitor.company} · {visitor.phone}
              </span>
            </span>
          </>
        )}
      />

      <div>
        <h2 className="text-[11px] font-bold tracking-wide text-muted uppercase">Added guests</h2>

        {selectedIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No guests yet. Search above to add the people you are expecting.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {selectedIds.map((id) => {
              const visitor = visitIndex.visitors.get(id);
              if (!visitor) return null;
              return (
                <li key={id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <Avatar name={visitor.fullName} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{visitor.fullName}</p>
                    <p className="truncate text-xs text-muted">{visitor.company}</p>
                  </div>
                  <button
                    onClick={() => onRemove(id)}
                    aria-label={`Remove ${visitor.fullName}`}
                    className="rounded-md px-2 text-xl leading-none text-muted hover:bg-canvas hover:text-danger"
                  >
                    &times;
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- combobox ----------------------------- */

interface ComboboxProps<T> {
  label: string;
  placeholder: string;
  required?: boolean;
  text: string;
  onText: (value: string) => void;
  results: T[];
  error?: string | null;
  getKey: (item: T) => string;
  onPick: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
}

/**
 * A minimal, accessible combobox. Generic over the item type so the host and
 * guest pickers share one implementation - this is the one place the project
 * uses a TypeScript generic, and it earns it.
 */
function Combobox<T>({
  label,
  placeholder,
  required,
  text,
  onText,
  results,
  error,
  getKey,
  onPick,
  renderItem,
}: ComboboxProps<T>) {
  const [highlighted, setHighlighted] = useState(0);
  const listId = useRef(`combo-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => setHighlighted(0), [results]);

  const open = results.length > 0 && text.trim().length > 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={listId} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <input
        id={listId}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(event) => onText(event.target.value)}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlighted((i) => Math.min(i + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            onPick(results[highlighted]);
          } else if (event.key === 'Escape') {
            onText('');
          }
        }}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink"
      />

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      {open && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl"
        >
          {results.map((item, index) => (
            <li key={getKey(item)}>
              <button
                role="option"
                aria-selected={index === highlighted}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => onPick(item)}
                className={[
                  'flex w-full items-center gap-3 px-3 py-2 text-left',
                  index === highlighted ? 'bg-brand-soft' : 'hover:bg-canvas',
                ].join(' ')}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {text.trim().length > 0 && results.length === 0 && (
        <p className="text-xs text-muted">No matches for “{text}”.</p>
      )}
    </div>
  );
}
