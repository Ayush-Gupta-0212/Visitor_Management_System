import { ACCOUNTS } from '@/data/mockData'
import { hashPassword } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/rbac'
import { failure } from '@/lib/result'
import type { ActionResult, UserSession } from '@/types/vms'
import { getSessionUser, useAuthStore } from './useAuthStore'
import { useUiStore } from './useUiStore'
import { useVmsStore } from './useVmsStore'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000

/**
 * Checks credentials and starts a session for this browser tab. The same message
 * covers an unknown email and a wrong password, so the form never reveals which
 * accounts exist. Five misses in a row pause sign-in for 30 seconds.
 */
export async function signIn(email: string, password: string): Promise<ActionResult<UserSession>> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !password) return failure('VALIDATION', 'Enter your work email and password.')

  const { lockedUntil, failedAttempts } = useAuthStore.getState()
  const now = Date.now()
  if (lockedUntil && now < lockedUntil) {
    return failure('UNAUTHORIZED', `Too many failed attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)} s.`)
  }

  let hash: string
  try {
    hash = await hashPassword(normalized, password)
  } catch {
    return failure('UNAUTHORIZED', 'Sign-in needs a secure connection. Open the app on localhost or over https://.')
  }

  const account = ACCOUNTS.find(({ user }) => user.email === normalized)
  if (!account || account.passwordHash !== hash) {
    const attempts = failedAttempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      useAuthStore.setState({ failedAttempts: 0, lockedUntil: now + LOCKOUT_MS })
      return failure('UNAUTHORIZED', 'Too many failed attempts. Sign-in is paused for 30 seconds.')
    }
    useAuthStore.setState({ failedAttempts: attempts, lockedUntil: null })
    const left = MAX_ATTEMPTS - attempts
    return failure('UNAUTHORIZED', `Incorrect email or password. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`)
  }

  const { user } = account
  useAuthStore.setState({ userId: user.id, failedAttempts: 0, lockedUntil: null })
  useUiStore.getState().closeAll()
  const vms = useVmsStore.getState()
  vms.resetFilters()
  vms.recordSecurityEvent('SIGNED_IN', user, `Signed in as ${ROLE_LABELS[user.role]}`)
  return { ok: true, data: user }
}

/** Ends this tab's session; other tabs keep theirs. */
export function signOut(): void {
  const user = getSessionUser()
  if (user) useVmsStore.getState().recordSecurityEvent('SIGNED_OUT', user, 'Signed out')
  useUiStore.getState().closeAll()
  useAuthStore.setState({ userId: null })
}
