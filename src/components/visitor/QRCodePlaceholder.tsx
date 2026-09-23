import { useMemo } from 'react'

/**
 * Stand-in for a real QR code. It draws a deterministic QR-like matrix from
 * `data` (finder squares, timing lines, pseudo-random modules) so every pass
 * looks distinct, but it is NOT scannable.
 *
 * Where production code plugs in:
 *
 * 1. Encoding: replace `buildModulePath` with a real encoder, e.g. the `qrcode`
 *    package's `QRCode.create(data).modules`, and draw those modules the same way.
 *    The props stay the same, so the pass and every other caller are untouched.
 *
 * 2. Token: `data` is `VisitorRecord.qrCodePlaceholder`, an opaque random UUID.
 *    In production the server would issue a signed, expiring token (HMAC or JWT
 *    over the visit id and approved window) so a screenshot can't be replayed
 *    outside the window or forged for another visitor.
 *
 * 3. Scanning at the desk: open the camera with `getUserMedia` (as PhotoCapture
 *    does), decode frames with the Shape Detection API's `BarcodeDetector` where
 *    available (Chromium) or a WASM decoder such as ZXing elsewhere, verify the
 *    signature, then resolve the token with `findVisitorByPassToken` (an O(1)
 *    index lookup) and call `checkInVisitor`. The Gatekeeper console's "Verify
 *    pass" box is that same path with the token typed in instead of scanned.
 */

/** A version-2 QR code is 25 × 25 modules. */
const MODULES = 25
/** White border required around a QR code, in modules. */
const QUIET_ZONE = 2
const FINDER_ORIGINS = [
  [0, 0],
  [0, MODULES - 7],
  [MODULES - 7, 0],
] as const

/** FNV-1a hash: turns the token into a 32-bit seed. */
function hash(text: string): number {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** xorshift32: a tiny deterministic generator, so a token always draws the same pattern. */
function seededRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
}

/** Dark/light for cells inside a finder pattern or its separator, or null elsewhere. */
function finderModule(row: number, col: number): boolean | null {
  for (const [top, left] of FINDER_ORIGINS) {
    const r = row - top
    const c = col - left
    if (r < -1 || r > 7 || c < -1 || c > 7) continue
    if (r < 0 || r > 6 || c < 0 || c > 6) return false // light separator around the finder
    const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3))
    return ring !== 2 // dark outer ring and 3 × 3 core, light ring between
  }
  return null
}

/** One SVG path covering every dark module. */
function buildModulePath(data: string): string {
  const random = seededRandom(hash(data))
  let path = ''
  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      const finder = finderModule(row, col)
      const timing = row === 6 || col === 6
      const dark = finder ?? (timing ? (row + col) % 2 === 0 : random() < 0.5)
      if (dark) path += `M${col} ${row}h1v1h-1z`
    }
  }
  return path
}

interface QRCodePlaceholderProps {
  data: string
  /** Rendered size in px (or user units when nested in another SVG). */
  size?: number
  /** Position when nested inside another SVG, such as the pass card. */
  x?: number
  y?: number
  className?: string
}

export function QRCodePlaceholder({ data, size = 128, x, y, className }: QRCodePlaceholderProps) {
  const path = useMemo(() => buildModulePath(data), [data])
  const extent = MODULES + QUIET_ZONE * 2

  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code placeholder"
      data-qr-placeholder=""
      className={className}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#0f172a" />
    </svg>
  )
}
