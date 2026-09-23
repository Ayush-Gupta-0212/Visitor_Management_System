import { initials } from './format'

/*
 * Visitor photos. Camera captures and uploads are centre-cropped to a square
 * and re-encoded as 320 px JPEGs (roughly 15–25 kB each), which keeps a busy
 * day of visitors well inside localStorage's ~5 MB budget.
 */

const PHOTO_SIZE = 320
const JPEG_QUALITY = 0.82
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Centre-crops `source` to a square, scales it to 320 px and returns a JPEG data URI. */
export function toPhotoDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const side = Math.min(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot process images.')
  context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/** Checks an uploaded file and converts it exactly like a camera capture. */
export async function fileToPhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPEG, PNG or WebP).')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That image is over 15 MB. Choose a smaller one.')

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return toPhotoDataUrl(image, image.naturalWidth, image.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Initials on a slate tile, as an inline SVG: the demo's stand-in for a photo. */
export function createMonogram(name: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
    '<rect width="96" height="96" fill="#e2e8f0"/>' +
    '<text x="48" y="48" dy="0.35em" text-anchor="middle" font-family="system-ui, sans-serif" ' +
    `font-size="34" font-weight="600" fill="#334155">${initials(name)}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
