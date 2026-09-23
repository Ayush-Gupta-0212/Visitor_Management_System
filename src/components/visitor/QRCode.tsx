import { useMemo } from 'react'
import { qrModules } from '@/lib/qr'

/** White margin around the code, in modules. Scanners need it to find the edges. */
const QUIET_ZONE = 2

/** One SVG path for every dark module, merging horizontal runs to keep the path short. */
function modulePath(modules: boolean[][]): string {
  let path = ''
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x]) x++
      path += `M${start} ${y}h${x - start}v1h${start - x}z`
    }
  })
  return path
}

interface QRCodeProps {
  /** Text to encode: for passes, the pass token. */
  value: string
  /** Rendered size in px (or user units when nested in another SVG). */
  size?: number
  /** Position when nested inside another SVG, such as the pass card. */
  x?: number
  y?: number
  className?: string
}

/**
 * A real, scannable QR code drawn as SVG. It stays black on white in dark mode too,
 * because scanners expect dark modules on a light background.
 */
export function QRCode({ value, size = 160, x, y, className }: QRCodeProps) {
  const { path, extent } = useMemo(() => {
    const modules = qrModules(value)
    return { path: modulePath(modules), extent: modules.length + QUIET_ZONE * 2 }
  }, [value])

  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Pass QR code"
      className={className}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#0f172a" />
    </svg>
  )
}
