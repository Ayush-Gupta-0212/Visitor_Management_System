import { Copy, Download, Printer } from 'lucide-react'
import { type Ref, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal'
import { formatDay, formatDuration, formatRelativeDay, formatTime, initials, minutesBetween } from '@/lib/format'
import { toast } from '@/lib/toast'
import { STATUS_LABELS, VISITOR_TYPE_LABELS } from '@/lib/visitorRules'
import { useVisitor } from '@/store/hooks'
import { useUiStore } from '@/store/useUiStore'
import type { VisitorRecord, VisitorStatus } from '@/types/vms'
import { QRCodePlaceholder } from './QRCodePlaceholder'

// Hex copies of the design tokens: a downloaded or printed SVG can't read the app's CSS variables.
const INK = '#0f172a'
const MUTED = '#64748b'
const FAINT = '#94a3b8'
const HAIRLINE = '#e4e4e7'
const SANS = 'Geist, system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

const PASS_STATES: Record<VisitorStatus, { label: string; ink: string; tint: string }> = {
  PRE_APPROVED: { label: 'VALID', ink: '#047857', tint: '#ecfdf5' },
  CHECKED_IN: { label: 'ON SITE', ink: '#047857', tint: '#ecfdf5' },
  OVERSTAY: { label: 'OVERSTAY', ink: '#be123c', tint: '#fff1f2' },
  PENDING_APPROVAL: { label: 'PENDING', ink: '#92400e', tint: '#fffbeb' },
  CHECKED_OUT: { label: 'USED', ink: '#475569', tint: '#f1f5f9' },
  REJECTED: { label: 'REVOKED', ink: '#be123c', tint: '#fff1f2' },
  EXPIRED: { label: 'EXPIRED', ink: '#475569', tint: '#f1f5f9' },
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** The pass for `passVisitorId` in the UI store; opened from the drawer, host lists and toasts. */
export function DigitalPassModal() {
  const passVisitorId = useUiStore((state) => state.passVisitorId)
  const closePass = useUiStore((state) => state.closePass)
  const visitor = useVisitor(passVisitorId)
  // Keep rendering the last pass while the dialog animates closed.
  const [shown, setShown] = useState(visitor)
  if (visitor && visitor !== shown) setShown(visitor)
  const display = visitor ?? shown

  return (
    <Modal open={Boolean(visitor)} onOpenChange={(open) => !open && closePass()}>
      <ModalContent size="sm">{display && <PassView visitor={display} />}</ModalContent>
    </Modal>
  )
}

function PassView({ visitor }: { visitor: VisitorRecord }) {
  const cardRef = useRef<SVGSVGElement>(null)
  const fileName = `visitor-pass-${visitor.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const serialize = () => (cardRef.current ? new XMLSerializer().serializeToString(cardRef.current) : null)

  const download = () => {
    const markup = serialize()
    if (!markup) return
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}.svg`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Pass downloaded', { description: `${fileName}.svg` })
  }

  // Prints from a bare window holding only the pass, so no app chrome ends up on paper.
  const print = () => {
    const markup = serialize()
    if (!markup) return
    const page =
      '<!doctype html><html><head><meta charset="utf-8"><title>Visitor pass</title>' +
      '<style>@page{margin:12mm}html,body{margin:0}body{display:grid;place-items:center;min-height:100vh}svg{width:86mm;height:auto}</style>' +
      `</head><body>${markup}<script>addEventListener('load', () => print())</script></body></html>`
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
    const printWindow = window.open(url, '_blank', 'width=480,height=720')
    if (!printWindow) {
      toast.error('Pop-up blocked', { description: 'Allow pop-ups for this site to print the pass, or download it instead.' })
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(visitor.qrCodePlaceholder)
      toast.success('Pass token copied', { description: 'Paste it into "Verify pass" on the Gatekeeper console.' })
    } catch {
      toast.info('Pass token', { description: visitor.qrCodePlaceholder, durationMs: 10_000 })
    }
  }

  return (
    <>
      <ModalHeader>
        <ModalTitle>Digital visitor pass</ModalTitle>
        <ModalDescription>
          {visitor.fullName} · {STATUS_LABELS[visitor.status]}
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="flex justify-center pt-1">
        <PassCard ref={cardRef} visitor={visitor} />
      </ModalBody>
      <ModalFooter className="justify-between">
        <Button variant="ghost" size="sm" onClick={() => void copyToken()}>
          <Copy /> Copy token
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={download}>
            <Download /> Download
          </Button>
          <Button onClick={print}>
            <Printer /> Print
          </Button>
        </div>
      </ModalFooter>
    </>
  )
}

function PassCard({ visitor, ref }: { visitor: VisitorRecord; ref: Ref<SVGSVGElement> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const state = PASS_STATES[visitor.status]
  const pillWidth = Math.round(state.label.length * 6.6 + 20)
  const overnight = formatDay(visitor.timeWindowStart) !== formatDay(visitor.timeWindowEnd)
  const windowLength = formatDuration(minutesBetween(visitor.timeWindowStart, visitor.timeWindowEnd))
  const token = visitor.qrCodePlaceholder

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 520"
      width="320"
      height="520"
      role="img"
      aria-label={`Visitor pass for ${visitor.fullName}: ${STATUS_LABELS[visitor.status]}`}
      className="h-auto w-full max-w-80"
    >
      <defs>
        <clipPath id={`${id}card`}>
          <rect width="320" height="520" rx="20" />
        </clipPath>
        <clipPath id={`${id}photo`}>
          <rect x="24" y="104" width="84" height="84" rx="14" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}card)`}>
        <rect width="320" height="520" fill="#ffffff" />
        <rect width="320" height="80" fill={INK} />
        <text x="24" y="31" fontFamily={MONO} fontSize="10" letterSpacing="1.6" fill={FAINT}>
          VISITOR PASS
        </text>
        <text x="24" y="58" fontFamily={SANS} fontSize="19" fontWeight="600" fill="#ffffff">
          PassKey VMS
        </text>
        <rect x={296 - pillWidth} y="24" width={pillWidth} height="22" rx="11" fill={state.tint} />
        <text
          x={296 - pillWidth / 2}
          y="39"
          textAnchor="middle"
          fontFamily={MONO}
          fontSize="10"
          fontWeight="600"
          letterSpacing="0.8"
          fill={state.ink}
        >
          {state.label}
        </text>

        {visitor.photoUrl ? (
          <image
            href={visitor.photoUrl}
            x="24"
            y="104"
            width="84"
            height="84"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${id}photo)`}
          />
        ) : (
          <>
            <rect x="24" y="104" width="84" height="84" rx="14" fill="#f1f5f9" />
            <text x="66" y="153" textAnchor="middle" fontFamily={MONO} fontSize="22" fontWeight="500" fill={MUTED}>
              {initials(visitor.fullName)}
            </text>
          </>
        )}
        <rect x="24.5" y="104.5" width="83" height="83" rx="13.5" fill="none" stroke={HAIRLINE} />

        <text x="124" y="131" fontFamily={SANS} fontSize="19" fontWeight="600" fill={INK}>
          {clip(visitor.fullName, 16)}
        </text>
        <text x="124" y="152" fontFamily={SANS} fontSize="12" fill={MUTED}>
          {clip(visitor.company || 'Independent visitor', 26)}
        </text>
        <text x="124" y="180" fontFamily={MONO} fontSize="10" letterSpacing="0.6" fill="#475569">
          {VISITOR_TYPE_LABELS[visitor.visitorType].toUpperCase()}
        </text>

        <line x1="24" x2="296" y1="212.5" y2="212.5" stroke={HAIRLINE} />
        <PassField x={24} y={236} label="HOST" value={clip(visitor.hostEmployeeName, 18)} detail={clip(visitor.hostDepartment, 22)} />
        <PassField x={168} y={236} label="OFFICE" value={clip(visitor.office, 18)} detail="Check in at the front desk" />
        <PassField x={24} y={294} label="DATE" value={formatDay(visitor.expectedDate)} detail={formatRelativeDay(visitor.timeWindowStart)} />
        <PassField
          x={168}
          y={294}
          label="WINDOW"
          value={`${formatTime(visitor.timeWindowStart)} – ${formatTime(visitor.timeWindowEnd)}`}
          detail={overnight ? `Ends ${formatDay(visitor.timeWindowEnd)}` : `${windowLength} window`}
          compact
        />
        <line x1="24" x2="296" y1="344.5" y2="344.5" stroke={HAIRLINE} />

        <QRCodePlaceholder data={token} size={124} x={98} y={356} />
        <text x="160" y="498" textAnchor="middle" fontFamily={MONO} fontSize="10" letterSpacing="0.6" fill={MUTED}>
          PASS {token.slice(0, 8).toUpperCase()} · {visitor.tempCardNumber ?? 'CARD AT DESK'}
        </text>
        <rect y="510" width="320" height="10" fill={state.ink} />
      </g>
      <rect x="0.5" y="0.5" width="319" height="519" rx="19.5" fill="none" stroke={HAIRLINE} />
    </svg>
  )
}

interface PassFieldProps {
  x: number
  y: number
  label: string
  value: string
  detail: string
  /** Slightly smaller value text, for long time ranges. */
  compact?: boolean
}

function PassField({ x, y, label, value, detail, compact = false }: PassFieldProps) {
  return (
    <>
      <text x={x} y={y} fontFamily={MONO} fontSize="9" letterSpacing="1" fill={FAINT}>
        {label}
      </text>
      <text x={x} y={y + 18} fontFamily={SANS} fontSize={compact ? 12 : 13} fontWeight="500" fill={INK}>
        {value}
      </text>
      <text x={x} y={y + 34} fontFamily={SANS} fontSize="11" fill={MUTED}>
        {detail}
      </text>
    </>
  )
}
