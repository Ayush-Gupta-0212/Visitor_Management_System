/*
 * Saving and printing the pass. The pass is a single SVG, so what's on screen,
 * on paper and in the downloaded file is guaranteed to be identical.
 */

const serialize = (svg: SVGSVGElement) => new XMLSerializer().serializeToString(svg)

/** Saves the pass as a standalone .svg file. */
export function downloadPass(svg: SVGSVGElement, fileName: string): void {
  const url = URL.createObjectURL(new Blob([serialize(svg)], { type: 'image/svg+xml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.svg`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Prints from a bare pop-up holding only the pass, so no app chrome ends up on paper.
 * Returns false when the browser blocked the pop-up.
 */
export function printPass(svg: SVGSVGElement): boolean {
  const page =
    '<!doctype html><html><head><meta charset="utf-8"><title>Visitor pass</title>' +
    '<style>@page{margin:12mm}html,body{margin:0}body{display:grid;place-items:center;min-height:100vh}svg{width:86mm;height:auto}</style>' +
    `</head><body>${serialize(svg)}<script>addEventListener('load', () => print())</script></body></html>`
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
  const printWindow = window.open(url, '_blank', 'width=480,height=720')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return printWindow !== null
}

export const passFileName = (name: string) => `visitor-pass-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
