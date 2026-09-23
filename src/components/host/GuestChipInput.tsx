import { Plus, Search, X } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useId, useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import type { FieldControlProps } from '@/components/ui/Field'
import { Input, fieldStyles } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { type FieldErrors, validateVisitorDetails } from '@/lib/visitorRules'
import { useVisibleVisitors } from '@/store/hooks'
import type { VisitorRecord } from '@/types/vms'

export interface GuestDraft {
  /** Lower-cased email or phone: identifies the guest across visits. */
  key: string
  fullName: string
  email: string
  phone: string
  company: string
}

/** The host's past guests, one per email or phone, most recent first. O(N log N). */
function pastGuests(visitors: readonly VisitorRecord[]): GuestDraft[] {
  const seen = new Set<string>()
  const guests: GuestDraft[] = []
  for (const visitor of [...visitors].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = (visitor.email || visitor.phone || visitor.fullName).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    guests.push({ key, fullName: visitor.fullName, email: visitor.email, phone: visitor.phone, company: visitor.company })
  }
  return guests
}

interface GuestChipInputProps extends Partial<FieldControlProps> {
  guests: GuestDraft[]
  onChange: (guests: GuestDraft[]) => void
}

/**
 * Multi-guest picker: search past guests by name, email or phone and add them as
 * chips, or add someone new inline. Backspace in the empty box removes the last chip.
 */
export function GuestChipInput({ guests, onChange, id, ...aria }: GuestChipInputProps) {
  const listId = useId()
  const visible = useVisibleVisitors()
  const directory = useMemo(() => pastGuests(visible), [visible])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [adding, setAdding] = useState(false)

  const added = new Set(guests.map((guest) => guest.key))
  const needle = query.trim().toLowerCase()
  const digits = needle.replace(/\D/g, '')
  const matches = needle
    ? directory
        .filter(
          (guest) =>
            !added.has(guest.key) &&
            (`${guest.fullName} ${guest.email} ${guest.company}`.toLowerCase().includes(needle) ||
              (digits.length >= 3 && guest.phone.replace(/\D/g, '').includes(digits))),
        )
        .slice(0, 5)
    : []

  const add = (guest: GuestDraft) => {
    onChange([...guests, guest])
    setQuery('')
    setActive(0)
  }
  const remove = (key: string) => onChange(guests.filter((guest) => guest.key !== key))

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && matches.length > 0) {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp' && matches.length > 0) {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (matches[active]) add(matches[active])
      else if (needle) setAdding(true)
    } else if (event.key === 'Backspace' && !query && guests.length > 0) {
      remove(guests[guests.length - 1].key)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id={id}
          {...aria}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search by name, email or phone"
          className={cn(fieldStyles, 'pl-9')}
        />
      </div>

      {matches.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Past guests" className="animate-fade-in overflow-hidden rounded-lg border border-border bg-surface p-1">
          {matches.map((guest, index) => (
            <li
              key={guest.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerMove={() => setActive(index)}
              onClick={() => add(guest)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5', index === active && 'bg-muted')}
            >
              <Avatar name={guest.fullName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md text-foreground">{guest.fullName}</span>
                <span className="block truncate text-body-sm text-muted-foreground">
                  {[guest.email || guest.phone, guest.company].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <NewGuestForm
          draft={query.trim()}
          taken={added}
          onAdd={(guest) => {
            add(guest)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 self-start rounded-sm text-body-sm text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <Plus className="size-3.5" aria-hidden />
          {needle && matches.length === 0 ? `Add “${query.trim()}” as a new guest` : 'Add a new guest'}
        </button>
      )}

      {guests.length > 0 && (
        <div className="mt-1">
          <p className="eyebrow mb-2">Added guests · {guests.length}</p>
          <ul className="flex flex-wrap gap-2">
            {guests.map((guest) => (
              <li
                key={guest.key}
                className="inline-flex max-w-full animate-pop-in items-center gap-2 rounded-full border border-border bg-surface py-1 pr-1 pl-1"
              >
                <Avatar name={guest.fullName} size="xs" />
                <span className="truncate text-body-md text-foreground">{guest.fullName}</span>
                <span className="hidden truncate text-body-sm text-muted-foreground sm:inline">{guest.company || guest.email || guest.phone}</span>
                <button
                  type="button"
                  aria-label={`Remove ${guest.fullName}`}
                  onClick={() => remove(guest.key)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface NewGuestFormProps {
  /** What was typed in the search box: prefills the name, or the contact if it looks like one. */
  draft: string
  taken: ReadonlySet<string>
  onAdd: (guest: GuestDraft) => void
  onCancel: () => void
}

/** Inline mini-form (not a nested <form>) for someone who hasn't visited before. */
function NewGuestForm({ draft, taken, onAdd, onCancel }: NewGuestFormProps) {
  const draftIsContact = draft.includes('@') || /^\+?[\d\s()-]{7,}$/.test(draft)
  const [name, setName] = useState(draftIsContact ? '' : draft)
  const [contact, setContact] = useState(draftIsContact ? draft : '')
  const [company, setCompany] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const submit = () => {
    const email = contact.includes('@') ? contact.trim() : ''
    const phone = email ? '' : contact.trim()
    const problems = validateVisitorDetails({ fullName: name, email, phone, company, purpose: 'Invited guest', visitorType: 'BUSINESS_GUEST' })
    const found: FieldErrors = {}
    if (problems.fullName) found.name = problems.fullName
    if (problems.email || problems.phone) found.contact = problems.email ?? problems.phone
    if (problems.company) found.company = problems.company
    const key = (email || phone).toLowerCase()
    if (!found.contact && taken.has(key)) found.contact = 'This guest is already on the invite.'
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    onAdd({ key, fullName: name.trim().replace(/\s+/g, ' '), email: email.toLowerCase(), phone, company: company.trim() })
  }

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

  return (
    <div role="group" aria-label="New guest" className="flex animate-fade-in flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <MiniField label="Full name" error={errors.name}>
          <Input autoFocus aria-invalid={errors.name ? true : undefined} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={submitOnEnter} placeholder="Guest's full name" />
        </MiniField>
        <MiniField label="Email or phone" error={errors.contact}>
          <Input aria-invalid={errors.contact ? true : undefined} value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={submitOnEnter} placeholder="name@company.com" />
        </MiniField>
        <MiniField label="Company" error={errors.company} className="sm:col-span-2">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={submitOnEnter} placeholder="Optional" />
        </MiniField>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline" size="sm" onClick={submit}>
          <Plus /> Add guest
        </Button>
      </div>
    </div>
  )
}

function MiniField({ label, error, className, children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-label-sm text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-body-sm text-danger-strong">{error}</span>}
    </label>
  )
}
