import { encode } from 'uqr'

/*
 * QR codes for e-passes. A pass's QR code holds only its token, an opaque random
 * UUID: short enough for a small code that scans easily, and meaningless without
 * the desk's records, so a photographed pass leaks nothing about the visit.
 */

/** Modules of the QR code for `text` (`true` = dark), without the quiet zone. Level M survives a scuffed screen. */
export function qrModules(text: string): boolean[][] {
  return encode(text, { ecc: 'M', border: 0 }).data
}

const TOKEN_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** The pass token in a scan result or pasted text, if there is one. */
export function extractPassToken(text: string): string | null {
  return text.match(TOKEN_PATTERN)?.[0].toLowerCase() ?? null
}

/** Reads a QR code from pixels. The jsQR decoder is only downloaded the first time a scanner needs it. */
export async function decodeQr(image: ImageData): Promise<string | null> {
  const { default: jsQR } = await import('jsqr')
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}
