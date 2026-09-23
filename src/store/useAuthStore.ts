import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { ACCOUNTS } from '@/data/mockData'
import type { UserSession } from '@/types/vms'
import { browserStorage } from './storage'

/*
 * Who is signed in. The session lives in sessionStorage, so every browser tab has
 * its own: a gatekeeper in one window and a host in another can work side by side,
 * while the visitor data they share stays in localStorage (see useLiveSync).
 * Sign-in and sign-out themselves are in session.ts.
 */

interface AuthState {
  userId: string | null
  failedAttempts: number
  /** Epoch ms until which sign-in is paused after repeated failures. */
  lockedUntil: number | null
}

export const useAuthStore = create<AuthState>()(
  persist((): AuthState => ({ userId: null, failedAttempts: 0, lockedUntil: null }), {
    name: 'vms-session',
    storage: createJSONStorage(() => browserStorage('sessionStorage')),
    partialize: (state) => ({ userId: state.userId }),
  }),
)

const usersById = new Map(ACCOUNTS.map(({ user }) => [user.id, user]))

/** The signed-in user, for code outside React (store actions). */
export function getSessionUser(): UserSession | null {
  const { userId } = useAuthStore.getState()
  return userId ? (usersById.get(userId) ?? null) : null
}

export function useSessionUser(): UserSession | null {
  const userId = useAuthStore((state) => state.userId)
  return userId ? (usersById.get(userId) ?? null) : null
}

/** The signed-in user, for screens that only render behind the sign-in gate. */
export function useUser(): UserSession {
  const user = useSessionUser()
  if (!user) throw new Error('This screen needs a signed-in user.')
  return user
}
