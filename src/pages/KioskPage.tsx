import { ArrowLeft, ArrowRight, CircleAlert, Clock3, Hourglass, LogIn, QrCode, Send, UserRoundPlus, XCircle } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { EmployeeCombobox } from '@/components/shared/EmployeeCombobox'
import { PhotoCapture } from '@/components/shared/PhotoCapture'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { PassScanner } from '@/components/visitor/PassScanner'
import { EMPLOYEE_DIRECTORY } from '@/data/mockData'
import { useNow } from '@/hooks/useNow'
import { formatDay, formatRelative, formatTime, formatWindow } from '@/lib/format'
import { WORKSPACE_HREF } from '@/lib/router'
import { cn } from '@/lib/utils'
import { findVisitorByPassToken } from '@/lib/visitorIndex'
import {
  type FieldErrors,
  PASS_NOT_FOUND,
  VISITOR_TYPE_LABELS,
  selfCheckInProblem,
  validateVisitorDetails,
  validateWalkIn,
} from '@/lib/visitorRules'
import { useVisitor } from '@/store/hooks'
import { KIOSK_SITE, useVmsStore } from '@/store/useVmsStore'
import type { KioskRequestInput, VisitorRecord, VisitorType } from '@/types/vms'

/*
 * The self-service kiosk on the lobby tablet. It needs no sign-in: visitors with a
 * pass check themselves in, and visitors without one ask their host for approval
 * and watch the answer arrive live (the host decides in their own window).
 */

type Screen =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'photo'; visitorId: string }
  | { name: 'blocked'; message: string }
  | { name: 'request' }
  | { name: 'waiting'; visitorId: string }
  | { name: 'done'; visitorId: string }

/** How long each screen may sit untouched before the kiosk returns to its welcome screen. */
const IDLE_MS: Record<Screen['name'], number | null> = {
  home: null,
  scan: 90_000,
  photo: 120_000,
  blocked: 20_000,
  request: 180_000,
  waiting: 15 * 60_000,
  done: 15_000,
}

export function KioskPage() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const home = () => setScreen({ name: 'home' })

  // Idle reset: any touch or key press restarts the countdown.
  useEffect(() => {
    const limit = IDLE_MS[screen.name]
    if (limit === null) return
    let timer = window.setTimeout(() => setScreen({ name: 'home' }), limit)
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setScreen({ name: 'home' }), limit)
    }
    window.addEventListener('pointerdown', restart)
    window.addEventListener('keydown', restart)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', restart)
      window.removeEventListener('keydown', restart)
    }
  }, [screen])

  const onToken = (token: string) => {
    const visitor = findVisitorByPassToken(useVmsStore.getState().visitors, token)
    if (!visitor) return setScreen({ name: 'blocked', message: PASS_NOT_FOUND })
    const problem = selfCheckInProblem(visitor, KIOSK_SITE, new Date())
    setScreen(problem ? { name: 'blocked', message: problem } : { name: 'photo', visitorId: visitor.id })
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 animate-float rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-400/5" />
      <KioskHeader />
      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div key={screen.name} className="animate-rise-in">
          {screen.name === 'home' && <Welcome onScan={() => setScreen({ name: 'scan' })} onRequest={() => setScreen({ name: 'request' })} />}
          {screen.name === 'scan' && (
            <Step title="Scan your visitor pass" description="Hold the QR code on your phone up to the camera, or use an image or the pass code." onBack={home}>
              <PassScanner onToken={onToken} facingMode="user" autoStart className="mx-auto w-full max-w-md" />
            </Step>
          )}
          {screen.name === 'photo' && (
            <PhotoStep visitorId={screen.visitorId} onBack={home} onBlocked={(message) => setScreen({ name: 'blocked', message })} onDone={() => setScreen({ name: 'done', visitorId: screen.visitorId })} />
          )}
          {screen.name === 'blocked' && <Blocked message={screen.message} onHome={home} onRetry={() => setScreen({ name: 'scan' })} />}
          {screen.name === 'request' && <RequestForm onBack={home} onSent={(visitorId) => setScreen({ name: 'waiting', visitorId })} />}
          {screen.name === 'waiting' && (
            <Waiting visitorId={screen.visitorId} onHome={home} onCheckedIn={() => setScreen({ name: 'done', visitorId: screen.visitorId })} onBlocked={(message) => setScreen({ name: 'blocked', message })} />
          )}
          {screen.name === 'done' && <Done visitorId={screen.visitorId} onHome={home} />}
        </div>
      </main>
    </div>
  )
}

function KioskHeader() {
  const now = useNow(15_000)
  return (
    <header className="relative border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <img src="/favicon.svg" alt="" className="size-9 rounded-[10px] dark:ring-1 dark:ring-border-strong" />
        <div className="min-w-0">
          <p className="text-headline-md leading-5">Visitor check-in</p>
          <p className="truncate text-body-sm text-muted-foreground">{KIOSK_SITE} · Main Lobby</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <p className="hidden text-right sm:block">
            <span className="block font-mono text-mono-metric tabular-nums">{formatTime(now)}</span>
            <span className="block text-body-sm text-muted-foreground">{formatDay(now)}</span>
          </p>
          <ThemeToggle />
          <a
            href={WORKSPACE_HREF}
            className="rounded-md px-2 py-1 text-body-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            Staff sign-in
          </a>
        </div>
      </div>
    </header>
  )
}

function Welcome({ onScan, onRequest }: { onScan: () => void; onRequest: () => void }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <p className="eyebrow">{greeting}</p>
        <h1 className="mt-2 text-[34px] leading-[42px] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[52px]">Welcome to {KIOSK_SITE}</h1>
        <p className="mx-auto mt-3 max-w-lg text-body-lg text-muted-foreground">Check in with your visitor pass, or let us know who you're here to see.</p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <ChoiceCard
          icon={QrCode}
          title="I have a visitor pass"
          text="Scan the QR code from your invitation to check yourself in."
          onClick={onScan}
          accent
          index={0}
        />
        <ChoiceCard
          icon={UserRoundPlus}
          title="I don't have a pass"
          text="Tell us who you're visiting and we'll ask them to approve you."
          onClick={onRequest}
          index={1}
        />
      </div>
      <p className="text-body-sm text-muted-foreground">Need help? Please speak to the security desk.</p>
    </div>
  )
}

interface ChoiceCardProps {
  icon: typeof QrCode
  title: string
  text: string
  onClick: () => void
  accent?: boolean
  index: number
}

function ChoiceCard({ icon: Icon, title, text, onClick, accent = false, index }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${80 + index * 80}ms` }}
      className={cn(
        'group flex animate-rise-in flex-col items-start gap-4 rounded-xl border p-6 text-left transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-overlay focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden active:scale-[0.99]',
        accent ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-surface text-foreground hover:border-border-strong',
      )}
    >
      <span className={cn('flex size-12 items-center justify-center rounded-lg', accent ? 'bg-primary-foreground/10' : 'bg-muted')}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span>
        <span className="block text-headline-md">{title}</span>
        <span className={cn('mt-1 block text-body-md', accent ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{text}</span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1.5 text-label-md">
        {accent ? 'Scan pass' : 'Request a visit'}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </button>
  )
}

function Step({ title, description, onBack, children }: { title: string; description: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to start">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-headline-lg">{title}</h1>
          <p className="mt-0.5 text-body-md text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

interface PhotoStepProps {
  visitorId: string
  onBack: () => void
  onBlocked: (message: string) => void
  onDone: () => void
}

/** The pass checked out: greet the visitor, take their badge photo, check them in. */
function PhotoStep({ visitorId, onBack, onBlocked, onDone }: PhotoStepProps) {
  const visitor = useVisitor(visitorId)
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string>()

  if (!visitor) return <Blocked message={PASS_NOT_FOUND} onHome={onBack} onRetry={onBack} />

  const checkIn = () => {
    const result = useVmsStore.getState().selfCheckIn(visitor.qrCodePlaceholder, photo ?? '')
    if (result.ok) return onDone()
    if (result.error.fields?.photoUrl) setError(result.error.fields.photoUrl)
    else onBlocked(result.error.message)
  }

  return (
    <Step title={`Welcome, ${visitor.fullName.split(' ')[0]}!`} description="Your pass is valid. Take a quick photo for your visitor badge, then check in." onBack={onBack}>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <VisitSummary visitor={visitor} />
        <div className="flex flex-col gap-3">
          <PhotoCapture
            value={photo}
            onChange={(next) => {
              setPhoto(next)
              setError(undefined)
            }}
            visitorName={visitor.fullName}
            error={error}
            messageId="kiosk-photo-message"
          />
          <Button className="h-11 text-body-lg" onClick={checkIn} disabled={!photo}>
            <LogIn /> Check in
          </Button>
        </div>
      </div>
    </Step>
  )
}

function VisitSummary({ visitor }: { visitor: VisitorRecord }) {
  const rows = [
    ['Visiting', `${visitor.hostEmployeeName} · ${visitor.hostDepartment}`],
    ['When', `${formatDay(visitor.expectedDate)}, ${formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}`],
    ['Company', visitor.company || 'Independent visitor'],
    ['Purpose', visitor.purpose],
  ]
  return (
    <dl className="flex flex-col divide-y divide-muted self-start rounded-xl border border-border bg-surface">
      {rows.map(([label, value]) => (
        <div key={label} className="px-5 py-3.5">
          <dt className="eyebrow">{label}</dt>
          <dd className="mt-1 text-body-lg text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Blocked({ message, onHome, onRetry }: { message: string; onHome: () => void; onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
      <span className="flex size-16 animate-pop-in items-center justify-center rounded-full border border-warning-border bg-warning-subtle">
        <CircleAlert className="size-8 text-warning" aria-hidden />
      </span>
      <h1 className="text-headline-lg">We couldn't check you in</h1>
      <p className="text-body-lg text-muted-foreground">{message}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRetry}>
          Scan again
        </Button>
        <Button onClick={onHome}>Back to start</Button>
      </div>
    </div>
  )
}

const STAY_OPTIONS = [
  { minutes: '30', label: '30 minutes' },
  { minutes: '60', label: '1 hour' },
  { minutes: '120', label: '2 hours' },
  { minutes: '240', label: 'Half a day' },
]

interface RequestFields {
  fullName: string
  phone: string
  email: string
  company: string
  purpose: string
  visitorType: VisitorType
  hostEmployeeId: string
  stayMinutes: string
}

const EMPTY_REQUEST: RequestFields = {
  fullName: '',
  phone: '',
  email: '',
  company: '',
  purpose: '',
  visitorType: 'BUSINESS_GUEST',
  hostEmployeeId: '',
  stayMinutes: '60',
}

/** A visitor without a pass asks their host for a visit. The store validates everything and names each problem. */
function RequestForm({ onBack, onSent }: { onBack: () => void; onSent: (visitorId: string) => void }) {
  const [form, setForm] = useState(EMPTY_REQUEST)
  const [photo, setPhoto] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  const clearError = (field: string) =>
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })

  const update = <K extends keyof RequestFields>(key: K, value: RequestFields[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    clearError(key === 'stayMinutes' ? 'expectedDurationMinutes' : key)
  }

  const showErrors = (problems: FieldErrors) => {
    flushSync(() => setErrors(problems))
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const input: KioskRequestInput = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      company: form.company,
      purpose: form.purpose,
      visitorType: form.visitorType,
      hostEmployeeId: form.hostEmployeeId,
      photoUrl: photo ?? '',
      expectedDurationMinutes: Number(form.stayMinutes),
    }

    // The store's own rules, run first so every problem shows at once and nothing is saved half-checked.
    const problems = { ...validateVisitorDetails(input), ...validateWalkIn(input, useVmsStore.getState().visitors) }
    if (!EMPLOYEE_DIRECTORY.some((employee) => employee.id === form.hostEmployeeId)) problems.hostEmployeeId = "Choose the person you're here to see."
    // Speak to the visitor rather than about them, and ask for a number even when an email is given, so the host can call.
    if (!form.fullName.trim()) problems.fullName = 'Enter your full name.'
    if (!form.phone.trim()) problems.phone = 'Enter your mobile number so your host can reach you.'
    if (!form.purpose.trim()) problems.purpose = "Tell us why you're visiting."
    if (!photo) problems.photoUrl = 'Take a photo for your visitor badge.'
    if (Object.keys(problems).length > 0) return showErrors(problems)

    const result = useVmsStore.getState().submitKioskRequest(input)
    if (!result.ok) return showErrors(result.error.fields ?? { fullName: result.error.message })
    onSent(result.data.id)
  }

  return (
    <Step title="Request a visit" description="Fill in your details. We'll ask your host to approve you; it usually takes a minute." onBack={onBack}>
      <form ref={formRef} noValidate onSubmit={submit} className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field id="kiosk-name" label="Full name" required error={errors.fullName} className="sm:col-span-2">
            {(control) => <Input {...control} autoFocus autoComplete="name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} className="h-11 text-body-lg" />}
          </Field>
          <Field id="kiosk-phone" label="Mobile number" required error={errors.phone}>
            {(control) => <Input {...control} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98200 12345" className="h-11 text-body-lg" />}
          </Field>
          <Field id="kiosk-email" label="Email" error={errors.email}>
            {(control) => <Input {...control} type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Optional" className="h-11 text-body-lg" />}
          </Field>
          <Field id="kiosk-host" label="Who are you visiting?" required error={errors.hostEmployeeId} className="sm:col-span-2">
            {(control) => <EmployeeCombobox {...control} value={form.hostEmployeeId} onChange={(id) => update('hostEmployeeId', id)} />}
          </Field>
          <Field id="kiosk-purpose" label="Purpose of visit" required error={errors.purpose} className="sm:col-span-2">
            {(control) => <Input {...control} value={form.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder="e.g. Interview, delivery, client meeting" className="h-11 text-body-lg" />}
          </Field>
          <Field id="kiosk-company" label="Company" error={errors.company}>
            {(control) => <Input {...control} autoComplete="organization" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Optional" className="h-11 text-body-lg" />}
          </Field>
          <Field id="kiosk-type" label="I am a…" required error={errors.visitorType}>
            {(control) => (
              <Select value={form.visitorType} onValueChange={(value) => update('visitorType', value as VisitorType)}>
                <SelectTrigger {...control} className="h-11 text-body-lg">
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
          <Field id="kiosk-stay" label="How long will you stay?" error={errors.expectedDurationMinutes} className="sm:col-span-2">
            {(control) => (
              <Select value={form.stayMinutes} onValueChange={(value) => update('stayMinutes', value)}>
                <SelectTrigger {...control} className="h-11 text-body-lg">
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
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-label-md text-foreground">
            Your photo
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
            messageId="kiosk-request-photo-message"
          />
          <Button type="submit" className="mt-auto h-11 text-body-lg">
            <Send /> Ask for approval
          </Button>
        </div>
      </form>
    </Step>
  )
}

interface WaitingProps {
  visitorId: string
  onHome: () => void
  onCheckedIn: () => void
  onBlocked: (message: string) => void
}

/** Watches the request live: the host's decision arrives from their own tab through the shared store. */
function Waiting({ visitorId, onHome, onCheckedIn, onBlocked }: WaitingProps) {
  const visitor = useVisitor(visitorId)
  const now = useNow(5_000)
  const status = visitor?.status

  // If the desk checks the visitor in from its own console, move on too.
  useEffect(() => {
    if (status === 'CHECKED_IN') onCheckedIn()
  }, [status, onCheckedIn])

  if (!visitor) return <Blocked message="Your request is no longer on file. Please see the front desk." onHome={onHome} onRetry={onHome} />
  const firstName = visitor.fullName.split(' ')[0]

  if (visitor.status === 'PRE_APPROVED') {
    const checkIn = () => {
      const result = useVmsStore.getState().selfCheckIn(visitor.qrCodePlaceholder, visitor.photoUrl ?? '')
      if (result.ok) onCheckedIn()
      else onBlocked(result.error.message)
    }
    return (
      <Outcome tone="success" icon={<CheckMark />} title={`You're approved, ${firstName}!`} text={`${visitor.hostEmployeeName} approved your visit. Check in to get your visitor card.`}>
        <Button className="h-11 text-body-lg" onClick={checkIn}>
          <LogIn /> Check in now
        </Button>
      </Outcome>
    )
  }

  if (visitor.status === 'REJECTED' || visitor.status === 'EXPIRED') {
    return (
      <Outcome
        tone="danger"
        icon={<XCircle className="size-9 text-danger" aria-hidden />}
        title={visitor.status === 'REJECTED' ? `Sorry, ${firstName}` : 'Your request expired'}
        text={
          visitor.status === 'REJECTED'
            ? `${visitor.hostEmployeeName} can't approve this visit${visitor.rejectionReason ? `: “${visitor.rejectionReason}”` : '.'} Please speak to the front desk.`
            : 'Your host didn’t respond in time. Please speak to the front desk.'
        }
      >
        <Button onClick={onHome}>Back to start</Button>
      </Outcome>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
      <span className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-warning-dot/25 [animation-duration:2s]" aria-hidden />
        <span className="absolute inset-2 animate-glow rounded-full bg-warning-subtle" aria-hidden />
        <Avatar name={visitor.hostEmployeeName} size="lg" className="relative size-16 text-body-lg" />
      </span>
      <div role="status">
        <h1 className="text-headline-lg">Waiting for {visitor.hostEmployeeName}</h1>
        <p className="mt-2 text-body-lg text-muted-foreground">
          We've asked {visitor.hostEmployeeName.split(' ')[0]} to approve your visit. This screen updates the moment they respond.
        </p>
      </div>
      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-body-sm text-muted-foreground">
        <Hourglass className="size-4 animate-pulse" aria-hidden /> Requested {formatRelative(visitor.createdAt, now)}
        <span aria-hidden>·</span>
        <Clock3 className="size-4" aria-hidden /> {formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}
      </p>
      <Button variant="ghost" onClick={onHome}>
        I'll wait at the desk
      </Button>
    </div>
  )
}

function Done({ visitorId, onHome }: { visitorId: string; onHome: () => void }) {
  const visitor = useVisitor(visitorId)
  if (!visitor) return null
  return (
    <Outcome
      tone="success"
      icon={<CheckMark />}
      title={`You're checked in, ${visitor.fullName.split(' ')[0]}!`}
      text={`${visitor.hostEmployeeName} knows you're here. Please collect your visitor card from the front desk and wear it at all times.`}
    >
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 text-left">
        <Avatar name={visitor.fullName} src={visitor.photoUrl} size="lg" className="size-14" />
        <div>
          <p className="eyebrow">Visitor card</p>
          <p className="font-mono text-[28px] leading-9 font-medium tracking-tight">{visitor.tempCardNumber}</p>
          <p className="text-body-sm text-muted-foreground">Valid until {formatTime(visitor.timeWindowEnd)}</p>
        </div>
      </div>
      <Button variant="outline" onClick={onHome}>
        Done
      </Button>
    </Outcome>
  )
}

function Outcome({ tone, icon, title, text, children }: { tone: 'success' | 'danger'; icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
      <span
        className={cn(
          'flex size-20 animate-pop-in items-center justify-center rounded-full border',
          tone === 'success' ? 'border-success-border bg-success-subtle' : 'border-danger-border bg-danger-subtle',
        )}
      >
        {icon}
      </span>
      <div role="status">
        <h1 className="text-headline-lg">{title}</h1>
        <p className="mt-2 text-body-lg text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  )
}

/** A tick that draws itself. */
function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-10 text-success" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} className="animate-draw" />
    </svg>
  )
}
