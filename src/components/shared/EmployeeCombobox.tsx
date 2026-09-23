import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { type KeyboardEvent, useId, useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import type { FieldControlProps } from '@/components/ui/Field'
import { fieldStyles } from '@/components/ui/Input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { EMPLOYEE_DIRECTORY } from '@/data/mockData'
import { cn } from '@/lib/utils'

interface EmployeeComboboxProps extends Partial<FieldControlProps> {
  value: string
  onChange: (employeeId: string) => void
}

/** Host picker: a searchable listbox over the employee directory (name, department or email). */
export function EmployeeCombobox({ value, onChange, id, ...aria }: EmployeeComboboxProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const selected = EMPLOYEE_DIRECTORY.find((employee) => employee.id === value)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return EMPLOYEE_DIRECTORY
    return EMPLOYEE_DIRECTORY.filter((e) => `${e.name} ${e.department} ${e.email}`.toLowerCase().includes(needle))
  }, [query])

  const choose = (employeeId: string) => {
    onChange(employeeId)
    setOpen(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    setQuery('')
    setActive(0)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && matches[active]) {
      event.preventDefault()
      choose(matches[active].id)
    }
  }

  const optionId = (employeeId: string) => `${listId}-${employeeId}`

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          {...aria}
          className={cn(fieldStyles, 'items-center justify-between gap-2 text-left')}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={selected.name} src={selected.avatar} size="xs" />
              <span className="truncate">{selected.name}</span>
              <span className="hidden truncate text-muted-foreground sm:inline">· {selected.department}</span>
            </span>
          ) : (
            <span className="truncate text-placeholder">Search by name or department</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={matches[active] ? optionId(matches[active].id) : undefined}
            aria-label="Search employees"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search employees…"
            className="h-10 min-w-0 flex-1 bg-transparent text-body-md outline-hidden placeholder:text-placeholder"
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Employees" className="max-h-64 overflow-y-auto p-1">
          {matches.map((employee, index) => (
            <li
              key={employee.id}
              id={optionId(employee.id)}
              role="option"
              aria-selected={employee.id === value}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(employee.id)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5', index === active && 'bg-muted')}
            >
              <Avatar name={employee.name} src={employee.avatar} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md text-foreground">{employee.name}</span>
                <span className="block truncate text-body-sm text-muted-foreground">{employee.department}</span>
              </span>
              {employee.id === value && <Check className="size-4 shrink-0" aria-hidden />}
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-6 text-center text-body-sm text-muted-foreground">No employees match “{query}”.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
