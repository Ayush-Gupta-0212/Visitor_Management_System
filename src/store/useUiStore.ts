import { create } from 'zustand'

/*
 * UI-only state: which visitor's drawer or pass is open and which dialogs are up.
 * Kept apart from the domain store so it is never persisted, and so any component
 * (a table row, the notification bell, a toast action) can open a shared overlay.
 */

interface UiState {
  detailVisitorId: string | null
  passVisitorId: string | null
  walkInOpen: boolean
  inviteOpen: boolean
  /** Bumped on every open, keying the dialog's form so it starts empty. */
  walkInSession: number
  inviteSession: number

  openDetails: (visitorId: string) => void
  closeDetails: () => void
  openPass: (visitorId: string) => void
  closePass: () => void
  openWalkIn: () => void
  closeWalkIn: () => void
  openInvite: () => void
  closeInvite: () => void
  closeAll: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  detailVisitorId: null,
  passVisitorId: null,
  walkInOpen: false,
  inviteOpen: false,
  walkInSession: 0,
  inviteSession: 0,

  openDetails: (visitorId) => set({ detailVisitorId: visitorId }),
  closeDetails: () => set({ detailVisitorId: null }),
  openPass: (visitorId) => set({ passVisitorId: visitorId }),
  closePass: () => set({ passVisitorId: null }),
  openWalkIn: () => set((state) => ({ walkInOpen: true, walkInSession: state.walkInSession + 1 })),
  closeWalkIn: () => set({ walkInOpen: false }),
  openInvite: () => set((state) => ({ inviteOpen: true, inviteSession: state.inviteSession + 1 })),
  closeInvite: () => set({ inviteOpen: false }),
  closeAll: () => set({ detailVisitorId: null, passVisitorId: null, walkInOpen: false, inviteOpen: false }),
}))
