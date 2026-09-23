import { type Ref, useId } from 'react'
import { formatDay, formatDuration, formatRelativeDay, formatTime, initials, minutesBetween } from '@/lib/format'
import type { PassDetails } from '@/lib/passLink'
import { STATUS_LABELS, VISITOR_TYPE_LABELS } from '@/lib/visitorRules'
import type { VisitorStatus } from '@/types/vms'
import { QRCode } from './QRCode'

// Hex copies of the design tokens: a downloaded or printed SVG can't read the app's CSS variables.
// The pass is a physical-looking card, so it stays light in dark mode too.
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

interface PassCardProps {
  pass: PassDetails
  ref?: Ref<SVGSVGElement>
  className?: string
}

/** The e-pass as one self-contained SVG: what's on screen is exactly what downloads and prints. */
export function PassCard({ pass, ref, className = 'h-auto w-full max-w-80' }: PassCardProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const state = PASS_STATES[pass.status]
  const pillWidth = Math.round(state.label.length * 6.6 + 20)
  const overnight = formatDay(pass.timeWindowStart) !== formatDay(pass.timeWindowEnd)
  const windowLength = formatDuration(minutesBetween(pass.timeWindowStart, pass.timeWindowEnd))
  const token = pass.qrCodePlaceholder

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 520"
      width="320"
      height="520"
      role="img"
      aria-label={`Visitor pass for ${pass.fullName}: ${STATUS_LABELS[pass.status]}`}
      className={className}
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
        <text x={296 - pillWidth / 2} y="39" textAnchor="middle" fontFamily={MONO} fontSize="10" fontWeight="600" letterSpacing="0.8" fill={state.ink}>
          {state.label}
        </text>

        {pass.photoUrl ? (
          <image href={pass.photoUrl} x="24" y="104" width="84" height="84" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}photo)`} />
        ) : (
          <>
            <rect x="24" y="104" width="84" height="84" rx="14" fill="#f1f5f9" />
            <text x="66" y="153" textAnchor="middle" fontFamily={MONO} fontSize="22" fontWeight="500" fill={MUTED}>
              {initials(pass.fullName)}
            </text>
          </>
        )}
        <rect x="24.5" y="104.5" width="83" height="83" rx="13.5" fill="none" stroke={HAIRLINE} />

        <text x="124" y="131" fontFamily={SANS} fontSize="19" fontWeight="600" fill={INK}>
          {clip(pass.fullName, 16)}
        </text>
        <text x="124" y="152" fontFamily={SANS} fontSize="12" fill={MUTED}>
          {clip(pass.company || 'Independent visitor', 26)}
        </text>
        <text x="124" y="180" fontFamily={MONO} fontSize="10" letterSpacing="0.6" fill="#475569">
          {VISITOR_TYPE_LABELS[pass.visitorType].toUpperCase()}
        </text>

        <line x1="24" x2="296" y1="212.5" y2="212.5" stroke={HAIRLINE} />
        <PassField x={24} y={236} label="HOST" value={clip(pass.hostEmployeeName, 18)} detail={clip(pass.hostDepartment, 22)} />
        <PassField x={168} y={236} label="OFFICE" value={clip(pass.office, 18)} detail="Scan at the kiosk or desk" />
        <PassField x={24} y={294} label="DATE" value={formatDay(pass.expectedDate)} detail={formatRelativeDay(pass.timeWindowStart)} />
        <PassField
          x={168}
          y={294}
          label="WINDOW"
          value={`${formatTime(pass.timeWindowStart)} – ${formatTime(pass.timeWindowEnd)}`}
          detail={overnight ? `Ends ${formatDay(pass.timeWindowEnd)}` : `${windowLength} window`}
          compact
        />
        <line x1="24" x2="296" y1="344.5" y2="344.5" stroke={HAIRLINE} />

        <QRCode value={token} size={124} x={98} y={356} />
        <text x="160" y="498" textAnchor="middle" fontFamily={MONO} fontSize="10" letterSpacing="0.6" fill={MUTED}>
          PASS {token.slice(0, 8).toUpperCase()} · {pass.tempCardNumber ?? 'CARD AT DESK'}
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
