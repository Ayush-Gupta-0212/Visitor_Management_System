import { Info, Send, UserCheck } from 'lucide-react'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { EmployeeCombobox } from '@/components/shared/EmployeeCombobox'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { EMPLOYEE_DIRECTORY } from '@/data/mockData'
import { notifyError } from '@/lib/feedback'
import { toast } from '@/lib/toast'
import {
  type FieldErrors,
  VISITOR_TYPE_LABELS,
  nextFreeCard,
  validateVisitorDetails,
  validateWalkIn,
} from '@/lib/visitorRules'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorType, WalkInInput } from '@/types/vms'
import { PhotoCapture } from './PhotoCapture'

const STAY_OPTIONS = [
  { minutes: '30', label: '30 minutes' },
  { minutes: '60', label: '1 hour' },
  { minutes: '120', label: '2 hours' },
  { minutes: '240', label: '4 hours' },
  { minutes: '480', label: '8 hours (shift)' },
]

interface WalkInFields {
  fullName: string
  phone: string
  email: string
  company: string
  purpose: string
  visitorType: VisitorType
  hostEmployeeId: string
  stayMinutes: string
  tempCardNumber: string
}

const EMPTY_FORM: WalkInFields = {
  fullName: '',
  phone: '',
  email: '',
  company: '',
  purpose: '',
  visitorType: 'BUSINESS_GUEST',
  hostEmployeeId: '',
  stayMinutes: '120',
  tempCardNumber: '',
}

/** Front-desk registration for unannounced visitors. Opened through the UI store (`openWalkIn`). */
export function WalkInRegistrationModal() {
  const open = useUiStore((state) => state.walkInOpen)
  const session = useUiStore((state) => state.walkInSession)
  const closeWalkIn = useUiStore((state) => state.closeWalkIn)

  return (
    <Modal open={open} onOpenChange={(next) => !next && closeWalkIn()}>
      <ModalContent size="xl">
        <WalkInForm key={session} onDone={closeWalkIn} />
      </ModalContent>
    </Modal>
  )
}

type SubmitMode = 'admit' | 'request'

function WalkInForm({ onDone }: { onDone: () => void }) {
  const visitors = useVmsStore((state) => state.visitors)
  const [form, setForm] = useState<WalkInFields>(EMPTY_FORM)
  const [photo, setPhoto] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const nextCard = useMemo(() => nextFreeCard(visitors), [visitors])

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })

  const update = <K extends keyof WalkInFields>(key: K, value: WalkInFields[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    clearError(key === 'stayMinutes' ? 'expectedDurationMinutes' : key)
  }

  const input: WalkInInput = {
    fullName: form.fullName,
    phone: form.phone,
    email: form.email,
    company: form.company,
    purpose: form.purpose,
    visitorType: form.visitorType,
    hostEmployeeId: form.hostEmployeeId,
    photoUrl: photo ?? '',
    expectedDurationMinutes: Number(form.stayMinutes),
    tempCardNumber: form.tempCardNumber.trim() || undefined,
  }

  // The same rules the store enforces, run up front so every problem shows at once.
  const findProblems = (mode: SubmitMode): FieldErrors => {
    const checked = mode === 'request' ? { ...input, tempCardNumber: undefined } : input
    const problems = { ...validateVisitorDetails(checked), ...validateWalkIn(checked, visitors) }
    if (!form.phone.trim()) problems.phone = 'Enter a mobile number so the host and escort can reach the visitor.'
    if (!EMPLOYEE_DIRECTORY.some((employee) => employee.id === form.hostEmployeeId)) {
      problems.hostEmployeeId = 'Choose the employee the visitor is here to see.'
    }
    return problems
  }

  const submit = (mode: SubmitMode) => {
    const problems = findProblems(mode)
    if (Object.keys(problems).length > 0) {
      flushSync(() => setErrors(problems))
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }

    const store = useVmsStore.getState()
    const result = mode === 'admit' ? store.registerWalkInVisitor(input) : store.requestHostApproval(input)
    if (!result.ok) {
      if (result.error.fields) setErrors(result.error.fields)
      notifyError(result.error)
      return
    }

    const visitor = result.data
    if (mode === 'admit') {
      toast.success(`${visitor.fullName} checked in`, {
        description: `Temp card ${visitor.tempCardNumber} issued. ${visitor.hostEmployeeName} has been notified.`,
      })
    } else {
      toast.success('Approval requested', {
        description: `${visitor.hostEmployeeName} has been asked to approve ${visitor.fullName}. Check them in once approved.`,
      })
    }
    onDone()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit('admit')
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <ModalHeader>
        <ModalTitle>Register walk-in visitor</ModalTitle>
        <ModalDescription>
          Capture their details and photo, then check them in now or send the request to their host.
        </ModalDescription>
      </ModalHeader>

      <ModalBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field id="walkin-name" label="Full name" required error={errors.fullName} className="sm:col-span-2">
            {(control) => (
              <Input {...control} autoFocus autoComplete="off" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Legal full name" />
            )}
          </Field>
          <Field id="walkin-phone" label="Phone" required error={errors.phone}>
            {(control) => (
              <Input {...control} type="tel" autoComplete="off" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98200 12345" />
            )}
          </Field>
          <Field id="walkin-email" label="Email" error={errors.email}>
            {(control) => (
              <Input {...control} type="email" autoComplete="off" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="name@company.com" />
            )}
          </Field>
          <Field id="walkin-purpose" label="Purpose of visit" required error={errors.purpose} className="sm:col-span-2">
            {(control) => (
              <Input {...control} value={form.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder="e.g. HVAC maintenance, Floor 3" />
            )}
          </Field>
          <Field id="walkin-type" label="Visitor category" required error={errors.visitorType}>
            {(control) => (
              <Select value={form.visitorType} onValueChange={(value) => update('visitorType', value as VisitorType)}>
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VISITOR_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field id="walkin-company" label="Company name" error={errors.company}>
            {(control) => (
              <Input {...control} value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Optional" />
            )}
          </Field>
          <Field id="walkin-host" label="Host employee" required error={errors.hostEmployeeId} className="sm:col-span-2">
            {(control) => (
              <EmployeeCombobox {...control} value={form.hostEmployeeId} onChange={(id) => update('hostEmployeeId', id)} />
            )}
          </Field>
          <Field id="walkin-stay" label="Expected stay" error={errors.expectedDurationMinutes}>
            {(control) => (
              <Select value={form.stayMinutes} onValueChange={(value) => update('stayMinutes', value)}>
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAY_OPTIONS.map((option) => (
                    <SelectItem key={option.minutes} value={option.minutes}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field
            id="walkin-card"
            label="Temp card ID"
            error={errors.tempCardNumber}
            hint={nextCard ? `Leave blank to issue ${nextCard}` : 'Every card is in use'}
          >
            {(control) => (
              <Input
                {...control}
                value={form.tempCardNumber}
                onChange={(e) => update('tempCardNumber', e.target.value.toUpperCase())}
                placeholder={nextCard ?? 'TC-101'}
                className="font-mono uppercase"
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-label-md text-foreground">
            Visitor photo
            <span className="text-danger" aria-hidden>
              {' '}
              *
            </span>
          </p>
          <PhotoCapture
            value={photo}
            onChange={(next) => {
              setPhoto(next)
              clearError('photoUrl')
            }}
            visitorName={form.fullName}
            error={errors.photoUrl}
            messageId="walkin-photo-message"
          />
        </div>
      </ModalBody>

      <ModalFooter className="flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden /> The host is notified either way.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => submit('request')}>
            <Send /> Send for host approval
          </Button>
          <Button type="submit">
            <UserCheck /> Check in now
          </Button>
        </div>
      </ModalFooter>
    </form>
  )
}
