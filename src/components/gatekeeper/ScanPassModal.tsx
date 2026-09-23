import { CircleAlert, LogIn, PanelRightOpen, RotateCcw, ScanLine, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle, ModalTrigger } from '@/components/ui/Modal'
import { PassScanner } from '@/components/visitor/PassScanner'
import { VisitorStatusBadge } from '@/components/visitor/VisitorStatusBadge'
import { useNow } from '@/hooks/useNow'
import { checkInAndNotify } from '@/lib/feedback'
import { formatDay, formatWindow } from '@/lib/format'
import { authorize } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { findVisitorByPassToken } from '@/lib/visitorIndex'
import { VISITOR_TYPE_LABELS, checkInWindowError } from '@/lib/visitorRules'
import { useUser } from '@/store/useAuthStore'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorRecord } from '@/types/vms'

/**
 * "Scan pass" at the front desk: read a visitor's QR e-pass with the webcam (or from an
 * image or typed code), see who it belongs to, and check them in from the same dialog.
 * The token resolves through the O(1) pass-token index.
 */
export function ScanPassButton() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setSession((count) => count + 1)
      }}
    >
      <ModalTrigger asChild>
        <Button variant="outline">
          <ScanLine /> Scan pass
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ScanFlow key={session} onDone={() => setOpen(false)} />
      </ModalContent>
    </Modal>
  )
}

function ScanFlow({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Read live, so the card updates if the visit changes while the dialog is open.
  const visitor = useVmsStore((state) => (token ? findVisitorByPassToken(state.visitors, token) : undefined))

  const scanAgain = () => {
    setToken(null)
    setAttempt((count) => count + 1)
  }

  return (
    <>
      <ModalHeader>
        <ModalTitle>Scan visitor pass</ModalTitle>
        <ModalDescription>Hold the QR code on the visitor's e-pass up to the camera, or use an image or the pass code.</ModalDescription>
      </ModalHeader>
      <ModalBody>
        {token === null ? (
          <PassScanner key={attempt} onToken={setToken} autoStart />
        ) : visitor ? (
          <PassMatch visitor={visitor} onDone={onDone} />
        ) : (
          <div role="alert" className="flex animate-pop-in flex-col items-center gap-2 rounded-lg border border-danger-border bg-danger-subtle px-4 py-8 text-center">
            <SearchX className="size-6 text-danger" aria-hidden />
            <p className="text-body-md font-medium text-danger-strong">No visit matches this pass</p>
            <p className="text-body-sm text-danger-strong">It may have been issued elsewhere or deleted by a reset. Register the visitor as a walk-in instead.</p>
          </div>
        )}
      </ModalBody>
      {token !== null && (
        <ModalFooter>
          <Button variant="outline" onClick={scanAgain}>
            <RotateCcw /> Scan another pass
          </Button>
        </ModalFooter>
      )}
    </>
  )
}

function PassMatch({ visitor, onDone }: { visitor: VisitorRecord; onDone: () => void }) {
  const user = useUser()
  const now = useNow(10_000)
  const offSite = authorize(user, 'visitor:check-in', visitor)
  const outsideWindow = visitor.status === 'PRE_APPROVED' ? checkInWindowError(visitor, now) : null
  const warning = offSite?.message ?? outsideWindow ?? STATUS_NOTES[visitor.status]
  const canCheckIn = !offSite && !outsideWindow && visitor.status === 'PRE_APPROVED'

  const openDetails = () => {
    onDone()
    useUiStore.getState().openDetails(visitor.id)
  }

  return (
    <div className="flex animate-pop-in flex-col gap-4">
      <div className="flex items-center gap-4 rounded-lg border border-border p-4">
        <Avatar name={visitor.fullName} src={visitor.photoUrl} size="lg" className="size-16 text-body-lg" />
        <div className="min-w-0 flex-1">
          <VisitorStatusBadge visitor={visitor} now={now} />
          <p className="mt-1.5 truncate text-headline-md">{visitor.fullName}</p>
          <p className="truncate text-body-sm text-muted-foreground">
            {[visitor.company, VISITOR_TYPE_LABELS[visitor.visitorType]].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <Detail label="Host" value={visitor.hostEmployeeName} />
        <Detail label="Office" value={visitor.office} />
        <Detail label="Date" value={formatDay(visitor.expectedDate)} />
        <Detail label="Window" value={formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)} mono />
      </dl>
      {warning && (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm',
            canCheckIn || visitor.status === 'CHECKED_IN'
              ? 'border-border bg-background text-muted-foreground'
              : 'border-warning-border bg-warning-subtle text-warning-strong',
          )}
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {warning}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {canCheckIn && (
          <Button className="flex-1" onClick={() => checkInAndNotify(visitor) && onDone()}>
            <LogIn /> Check in {visitor.fullName.split(' ')[0]}
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={openDetails}>
          <PanelRightOpen /> Open visitor details
        </Button>
      </div>
    </div>
  )
}

/** What the desk should do with a pass that can't be checked in. */
const STATUS_NOTES: Record<VisitorRecord['status'], string | null> = {
  PRE_APPROVED: null,
  PENDING_APPROVAL: 'The host hasn’t approved this visit yet. Don’t admit the visitor until they do.',
  CHECKED_IN: 'Already on site. Open the details to check them out or extend their stay.',
  OVERSTAY: 'On site past their window. Check them out or extend their stay from the details.',
  CHECKED_OUT: 'This pass was already used; the visitor has checked out.',
  REJECTED: 'The host revoked this pass. Do not admit this visitor.',
  EXPIRED: 'This pass expired before the visitor checked in.',
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface p-3">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('mt-1 truncate text-body-md text-foreground', mono && 'font-mono text-mono-code')}>{value}</dd>
    </div>
  )
}
