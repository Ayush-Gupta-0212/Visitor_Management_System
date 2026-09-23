import { ArrowRight, BellRing, Eye, EyeOff, KeyRound, LoaderCircle, QrCode, ShieldCheck, TabletSmartphone } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { ROLE_ICONS } from '@/components/layout/roles'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PassCard } from '@/components/visitor/PassCard'
import { DEMO_PASSWORDS } from '@/data/demoCredentials'
import { ACCOUNTS, OFFICES } from '@/data/mockData'
import { useNow } from '@/hooks/useNow'
import { toIsoDate } from '@/lib/format'
import type { PassDetails } from '@/lib/passLink'
import { ROLE_LABELS } from '@/lib/rbac'
import { KIOSK_HREF } from '@/lib/router'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { signIn } from '@/store/session'
import { useAuthStore } from '@/store/useAuthStore'

const FEATURES = [
  { icon: ShieldCheck, title: 'Personal sign-in, role-based access', text: 'The desk, hosts and admins each see and do only what their role allows.' },
  { icon: QrCode, title: 'Scannable QR e-passes', text: 'Share passes by link, email or WhatsApp; scan them at the desk or the lobby kiosk.' },
  { icon: BellRing, title: 'Live across every screen', text: 'Approvals, check-ins and overstay alerts appear instantly in every open tab.' },
]

/** A sample pass for the brand panel, dated today so it always reads as current. */
function samplePass(now: Date): PassDetails {
  const start = new Date(now)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(11, 30)
  return {
    qrCodePlaceholder: '7c1e5f2a-93b4-4d8e-a6f1-2b9c0d4e8a17',
    fullName: 'Aarav Shah',
    company: 'Northwind Logistics',
    visitorType: 'BUSINESS_GUEST',
    hostEmployeeName: 'Lalita Mehta',
    hostDepartment: 'Internal Firm Services',
    office: OFFICES[0],
    expectedDate: toIsoDate(start),
    timeWindowStart: start.toISOString(),
    timeWindowEnd: end.toISOString(),
    status: 'PRE_APPROVED',
    photoUrl: null,
    tempCardNumber: null,
  }
}

/** Whether sign-in is paused right now after too many failed attempts. */
function isLockedOut(): boolean {
  const { lockedUntil } = useAuthStore.getState()
  return lockedUntil !== null && lockedUntil > Date.now()
}

/** Staff sign-in: a brand panel beside the form, plus one-click demo accounts for reviewers. */
export function LoginPage() {
  const [pass] = useState(() => samplePass(new Date()))

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
      <BrandPanel pass={pass} />
      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-8 rounded-[10px] dark:ring-1 dark:ring-border-strong" />
            <span className="text-headline-md">PassKey VMS</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <SignInCard />
        </div>
        <p className="text-center text-body-sm text-muted-foreground">
          Demo build · all data stays in this browser ·{' '}
          <a href={KIOSK_HREF} className="text-foreground underline-offset-2 hover:underline">
            Visitor kiosk
          </a>
        </p>
      </main>
    </div>
  )
}

function BrandPanel({ pass }: { pass: PassDetails }) {
  return (
    <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-10 xl:p-14">
      {/* Grid texture and two slow-drifting glows. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      />
      <div aria-hidden className="absolute -top-24 -left-20 size-96 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
      <div aria-hidden className="absolute -right-24 bottom-0 size-[28rem] animate-float rounded-full bg-indigo-500/20 blur-3xl [animation-delay:-4s]" />

      <div className="relative flex animate-rise-in items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="size-9 rounded-[10px] ring-1 ring-white/15" />
        <span className="text-headline-md">PassKey VMS</span>
      </div>

      <div className="relative grid items-center gap-10 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <div>
          <h1 className="animate-rise-in text-[40px] leading-[46px] font-semibold tracking-[-0.03em] [animation-delay:80ms]">
            Every visitor,
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">accounted for.</span>
          </h1>
          <p className="mt-4 max-w-md animate-rise-in text-body-lg text-slate-300 [animation-delay:160ms]">
            Pre-approvals, walk-ins, QR e-passes and overstay alerts for the {OFFICES[0]} front desk.
          </p>
          <ul className="mt-8 flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex animate-rise-in gap-3" style={{ animationDelay: `${240 + index * 80}ms` }}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                  <Icon className="size-4 text-emerald-300" aria-hidden />
                </span>
                <div>
                  <p className="text-body-md font-medium text-white">{title}</p>
                  <p className="text-body-sm text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden animate-rise-in [animation-delay:320ms] xl:block" aria-hidden>
          <div className="animate-float [animation-duration:7s]">
            <PassCard pass={pass} className="h-auto w-52 rotate-3 drop-shadow-[0_24px_48px_rgb(0_0_0/0.45)]" />
          </div>
        </div>
      </div>

      <p className="relative text-body-sm text-slate-500">Built for the MoveInSync frontend assignment · mock data only</p>
    </aside>
  )
}

function SignInCard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; attempt: number } | null>(null)
  const lockedUntil = useAuthStore((state) => state.lockedUntil)
  const now = useNow(lockedUntil ? 1000 : 60_000)
  const lockSeconds = lockedUntil ? Math.ceil((lockedUntil - now.getTime()) / 1000) : 0
  const locked = lockSeconds > 0

  const attempt = async (address: string, secret: string) => {
    setPending(address)
    const result = await signIn(address, secret)
    setPending(null)
    if (!result.ok) {
      // A lockout shows its own live countdown instead, so the message can't go stale when it ends.
      const lockedOut = isLockedOut()
      setError((current) => (lockedOut ? null : { message: result.error.message, attempt: (current?.attempt ?? 0) + 1 }))
      return
    }
    toast.success(`Welcome, ${result.data.name.split(' ')[0]}`, { description: `Signed in as ${ROLE_LABELS[result.data.role]} · ${result.data.office}` })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void attempt(email, password)
  }

  const signInAs = (address: string) => {
    const secret = DEMO_PASSWORDS[address]
    setEmail(address)
    setPassword(secret)
    setError(null)
    void attempt(address, secret)
  }

  return (
    <div className="w-full max-w-md animate-rise-in">
      <h2 className="text-headline-lg">Sign in</h2>
      <p className="mt-1 text-body-md text-muted-foreground">Use your work account. Each browser tab keeps its own session, so you can sign in as different people side by side.</p>

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" className="text-label-md text-foreground">
            Work email
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
            placeholder="name@corp.example"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" className="text-label-md text-foreground">
            Password
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </div>

        {(error || locked) && (
          <p
            key={locked ? 'locked' : error?.attempt}
            id="login-error"
            role="alert"
            className="animate-shake rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-body-sm text-danger-strong"
          >
            {locked ? `Too many failed attempts. Try again in ${lockSeconds} s.` : error?.message}
          </p>
        )}

        <Button type="submit" className="h-10" disabled={pending !== null || locked}>
          {pending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="eyebrow">Demo accounts · one click</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ACCOUNTS.map(({ user }, index) => {
            const Icon = ROLE_ICONS[user.role]
            const busy = pending === user.email
            return (
              <li key={user.id} className="animate-rise-in" style={{ animationDelay: `${120 + index * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => signInAs(user.email)}
                  disabled={pending !== null || locked}
                  title={`${user.email} · ${DEMO_PASSWORDS[user.email]}`}
                  aria-label={`Sign in as ${user.name}, ${ROLE_LABELS[user.role]}`}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface p-2 text-left transition-all',
                    'hover:-translate-y-px hover:border-border-strong hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                    'disabled:pointer-events-none disabled:opacity-60',
                  )}
                >
                  <Avatar name={user.name} src={user.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-md font-medium text-foreground">{user.name}</span>
                    <span className="flex items-center gap-1 truncate text-body-sm text-muted-foreground">
                      <Icon className="size-3 shrink-0" aria-hidden />
                      {ROLE_LABELS[user.role]}
                    </span>
                  </span>
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-hidden />
                  ) : (
                    <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-body-sm text-muted-foreground">
          Passwords follow <span className="font-mono text-mono-code text-foreground">firstname@123</span>, e.g.{' '}
          <span className="font-mono text-mono-code text-foreground">suresh@123</span>.
        </p>
      </div>

      <a
        href={KIOSK_HREF}
        className="group mt-6 flex items-center gap-3 rounded-lg border border-dashed border-border-strong p-3 transition-colors hover:border-foreground/40 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-muted">
          <TabletSmartphone className="size-4 text-foreground" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body-md font-medium text-foreground">Visiting today?</span>
          <span className="block text-body-sm text-muted-foreground">Open the self-service kiosk to check in with your pass or request a visit.</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </a>
    </div>
  )
}
