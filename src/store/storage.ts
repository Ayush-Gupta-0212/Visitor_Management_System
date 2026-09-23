import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage or sessionStorage for Zustand's persist middleware, made safe:
 * a failed write (for example a quota filled by captured photos) warns instead of
 * breaking the action, and outside a browser (unit tests) it simply stores nothing.
 */
export function browserStorage(kind: 'localStorage' | 'sessionStorage'): StateStorage {
  const store = () => (typeof window === 'undefined' ? undefined : window[kind])

  return {
    getItem: (name) => store()?.getItem(name) ?? null,
    setItem: (name, value) => {
      try {
        store()?.setItem(name, value)
      } catch (error) {
        console.warn(`[vms] Could not save to ${kind}; changes will last until the page reloads.`, error)
      }
    },
    removeItem: (name) => store()?.removeItem(name),
  }
}
