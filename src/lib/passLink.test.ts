import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { makeVisitor } from '@/test/fixtures'
import { encodePass, readPassLink, tokenFromText } from './passLink'
import { qrModules } from './qr'

describe('pass links', () => {
  it('round-trip the pass details, including non-ASCII names', () => {
    const visitor = makeVisitor({ fullName: 'Zoë Ångström', company: 'Café Müller' })
    const pass = readPassLink(encodePass(visitor))
    expect(pass).toMatchObject({
      qrCodePlaceholder: visitor.qrCodePlaceholder,
      fullName: 'Zoë Ångström',
      company: 'Café Müller',
      hostEmployeeName: visitor.hostEmployeeName,
      timeWindowStart: visitor.timeWindowStart,
      timeWindowEnd: visitor.timeWindowEnd,
    })
  })

  it('reject damaged links instead of throwing', () => {
    expect(readPassLink('not-a-pass')).toBeNull()
    expect(readPassLink(encodePass(makeVisitor()).slice(0, 40))).toBeNull()
  })

  it('find the token in a scan, a pasted code or a pasted link', () => {
    const visitor = makeVisitor()
    const token = visitor.qrCodePlaceholder
    expect(tokenFromText(token)).toBe(token)
    expect(tokenFromText(`  ${token.toUpperCase()} `)).toBe(token)
    expect(tokenFromText(`https://vms.example/#/pass/${encodePass(visitor)}`)).toBe(token)
    expect(tokenFromText('hello world')).toBeNull()
  })
})

describe('QR codes', () => {
  it('encode a pass token that a scanner decodes back exactly', () => {
    const token = '6c9f9564-7592-4b07-a368-48c586b348c6'
    const modules = qrModules(token)
    // Rasterize at 4 px per module with a 4-module quiet zone, as a camera frame would see it.
    const scale = 4
    const quiet = 4
    const size = (modules.length + quiet * 2) * scale
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255)
    modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (!dark) return
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const offset = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4
            pixels.fill(0, offset, offset + 3)
          }
        }
      }),
    )
    expect(jsQR(pixels, size, size)?.data).toBe(token)
  })
})
