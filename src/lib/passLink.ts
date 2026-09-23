import { parseISO } from 'date-fns'
import type { VisitorRecord, VisitorType } from '@/types/vms'
import { toIsoDate } from './format'
import { extractPassToken } from './qr'
import { VISITOR_TYPE_LABELS } from './visitorRules'

/** Everything the pass card shows. A VisitorRecord already has this shape. */
export type PassDetails = Pick<
  VisitorRecord,
  | 'qrCodePlaceholder'
  | 'fullName'
  | 'company'
  | 'visitorType'
  | 'hostEmployeeName'
  | 'hostDepartment'
  | 'office'
  | 'expectedDate'
  | 'timeWindowStart'
  | 'timeWindowEnd'
  | 'status'
  | 'photoUrl'
  | 'tempCardNumber'
>

/** What a shared link carries. Short keys keep the URL compact. */
interface PassLinkPayload {
  v: 1
  t: string // token
  n: string // visitor name
  c: string // company
  k: VisitorType
  h: string // host
  d: string // host department
  o: string // office
  s: string // window start
  e: string // window end
}

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (value: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)))

/** The pass details, packed for the URL. */
export function encodePass(visitor: VisitorRecord): string {
  const payload: PassLinkPayload = {
    v: 1,
    t: visitor.qrCodePlaceholder,
    n: visitor.fullName,
    c: visitor.company,
    k: visitor.visitorType,
    h: visitor.hostEmployeeName,
    d: visitor.hostDepartment,
    o: visitor.office,
    s: visitor.timeWindowStart,
    e: visitor.timeWindowEnd,
  }
  return toBase64Url(JSON.stringify(payload))
}

/**
 * A self-contained link to a visitor's e-pass. The details travel in the URL, so the
 * pass opens on the visitor's own phone even though this demo has no server. The desk
 * never trusts them: at check-in it looks the token up in its own records.
 */
export function createPassLink(visitor: VisitorRecord): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/pass/${encodePass(visitor)}`
}

/** The pass packed by `encodePass`, or null if the link is damaged. It reads as valid until checked against live records. */
export function readPassLink(encoded: string): PassDetails | null {
  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<PassLinkPayload>
    const text = [payload.t, payload.n, payload.c, payload.h, payload.d, payload.o, payload.s, payload.e]
    if (payload.v !== 1 || text.some((value) => typeof value !== 'string')) return null
    if (typeof payload.k !== 'string' || !Object.hasOwn(VISITOR_TYPE_LABELS, payload.k)) return null
    const start = parseISO(payload.s as string)
    if (Number.isNaN(start.getTime())) return null

    return {
      qrCodePlaceholder: payload.t as string,
      fullName: payload.n as string,
      company: payload.c as string,
      visitorType: payload.k,
      hostEmployeeName: payload.h as string,
      hostDepartment: payload.d as string,
      office: payload.o as string,
      expectedDate: toIsoDate(start),
      timeWindowStart: payload.s as string,
      timeWindowEnd: payload.e as string,
      status: 'PRE_APPROVED',
      photoUrl: null,
      tempCardNumber: null,
    }
  } catch {
    return null
  }
}

/** The pass token in scanned or pasted text: a bare token, or the one inside a pass link. */
export function tokenFromText(text: string): string | null {
  const direct = extractPassToken(text)
  if (direct) return direct
  const link = text.match(/#\/pass\/([\w-]+)/)
  return link ? (readPassLink(link[1])?.qrCodePlaceholder ?? null) : null
}
