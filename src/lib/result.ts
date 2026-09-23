import type { VmsError, VmsErrorCode } from '@/types/vms'
import type { FieldErrors } from './visitorRules'

/** A failed `ActionResult`. Store actions and sign-in both report failures this way instead of throwing. */
export function failure(code: VmsErrorCode, message: string, fields?: FieldErrors): { ok: false; error: VmsError } {
  return { ok: false, error: fields ? { code, message, fields } : { code, message } }
}
