import { CircleAlert, Download, Printer, Sun, TabletSmartphone } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { PassCard } from '@/components/visitor/PassCard'
import { formatTime } from '@/lib/format'
import { downloadPass, passFileName, printPass } from '@/lib/passExport'
import { type PassDetails, readPassLink } from '@/lib/passLink'
import { KIOSK_HREF } from '@/lib/router'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { findVisitorByPassToken } from '@/lib/visitorIndex'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorStatus } from '@/types/vms'

const GUIDANCE: Record<VisitorStatus, { tone: 'success' | 'warning' | 'danger'; text: (pass: PassDetails) => string }> = {
  PRE_APPROVED: { tone: 'success', text: () => 'Show this QR code at the lobby kiosk or the front desk to check in.' },
  PENDING_APPROVAL: { tone: 'warning', text: (pass) => `${pass.hostEmployeeName} hasn't approved this visit yet.` },
  CHECKED_IN: { tone: 'success', text: (pass) => `You're checked in${pass.tempCardNumber ? ` with visitor card ${pass.tempCardNumber}` : ''}. Enjoy your visit!` },
  OVERSTAY: { tone: 'danger', text: (pass) => `Your visit window ended at ${formatTime(pass.timeWindowEnd)}. Please check out at the front desk.` },
  CHECKED_OUT: { tone: 'warning', text: () => 'This pass has been used. Thanks for visiting!' },
  REJECTED: { tone: 'danger', text: (pass) => `${pass.hostEmployeeName} revoked this pass. Please contact your host.` },
  EXPIRED: { tone: 'warning', text: () => 'This pass expired. Ask your host for a new invitation.' },
}

const TONES = {
  success: 'border-success-border bg-success-subtle text-success-strong',
  warning: 'border-warning-border bg-warning-subtle text-warning-strong',
  danger: 'border-danger-border bg-danger-subtle text-danger-strong',
}

/**
 * A visitor's e-pass, opened from a shared link on their own phone. The link carries
 * the details; when this browser also holds the live record (as in the demo), the
 * status, photo and card number come from it instead.
 */
export function PublicPassPage({ payload }: { payload: string }) {
  const linked = useMemo(() => readPassLink(payload), [payload])
  const live = useVmsStore((state) => (linked ? findVisitorByPassToken(state.visitors, linked.qrCodePlaceholder) : undefined))
  const cardRef = useRef<SVGSVGElement>(null)
  const pass = live ?? linked

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8 rounded-[10px] dark:ring-1 dark:ring-border-strong" />
          <span className="text-headline-md">PassKey VMS</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-5 px-4 pb-10">
        {!pass ? (
          <div role="alert" className="mt-16 flex animate-rise-in flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-danger-border bg-danger-subtle">
              <CircleAlert className="size-7 text-danger" aria-hidden />
            </span>
            <h1 className="text-headline-lg">This pass link doesn't work</h1>
            <p className="text-body-md text-muted-foreground">It may have been cut off when it was copied. Ask your host to send it again.</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-headline-lg">Your visitor pass</h1>
              <p className="text-body-md text-muted-foreground">
                {pass.office} · hosted by {pass.hostEmployeeName}
              </p>
            </div>
            <PassCard ref={cardRef} pass={pass} className="h-auto w-full max-w-80 animate-rise-in drop-shadow-lg" />
            <p role="status" className={cn('w-full rounded-lg border px-4 py-3 text-center text-body-md', TONES[GUIDANCE[pass.status].tone])}>
              {GUIDANCE[pass.status].text(pass)}
            </p>
            <p className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground">
              <Sun className="size-4" aria-hidden /> Turn your screen brightness up when scanning.
            </p>
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!cardRef.current) return
                  downloadPass(cardRef.current, passFileName(pass.fullName))
                  toast.success('Pass saved', { description: 'Open the file at the kiosk if you lose signal.' })
                }}
              >
                <Download /> Save
              </Button>
              <Button variant="outline" onClick={() => cardRef.current && !printPass(cardRef.current) && toast.error('Pop-up blocked')}>
                <Printer /> Print
              </Button>
            </div>
            <a
              href={KIOSK_HREF}
              className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <TabletSmartphone className="size-4" aria-hidden /> At the lobby? Open the check-in kiosk
            </a>
          </>
        )}
      </main>
    </div>
  )
}
