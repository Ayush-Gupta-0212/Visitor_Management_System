import { useMemo, useSyncExternalStore } from 'react'

/*
 * Three screens, chosen by the URL hash so the app still deploys as static files:
 *   #/            staff workspace (sign-in first)
 *   #/kiosk       public self-service kiosk for the lobby
 *   #/pass/<data> a visitor's e-pass, opened from a shared link
 */

export type Route = { name: 'workspace' } | { name: 'kiosk' } | { name: 'pass'; payload: string }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '')
  if (path === '/kiosk') return { name: 'kiosk' }
  const pass = path.match(/^\/pass\/([\w-]+)$/)
  if (pass) return { name: 'pass', payload: pass[1] }
  return { name: 'workspace' }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return useMemo(() => parseRoute(hash), [hash])
}

export const KIOSK_HREF = '#/kiosk'
export const WORKSPACE_HREF = '#/'
