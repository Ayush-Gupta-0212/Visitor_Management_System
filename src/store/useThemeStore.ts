import { useEffect } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { browserStorage } from './storage'

export type ThemePreference = 'light' | 'dark' | 'system'
type Theme = 'light' | 'dark'

/**
 * The chosen theme, remembered on this device. A small script in index.html applies
 * it before the first paint, so the page never flashes the wrong theme on load.
 */
const THEME_KEY = 'vms-theme'

export const useThemeStore = create<{ preference: ThemePreference }>()(
  persist(() => ({ preference: 'system' as ThemePreference }), {
    name: THEME_KEY,
    storage: createJSONStorage(() => browserStorage('localStorage')),
  }),
)

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== 'system') return preference
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** The theme on screen right now, following the OS while the preference is "system". */
export function useResolvedTheme(): Theme {
  const preference = useThemeStore((state) => state.preference)
  const systemDark = useMediaQuery(DARK_QUERY)
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

const applyTheme = (theme: Theme) => document.documentElement.classList.toggle('dark', theme === 'dark')

/**
 * Switches the theme. Where the View Transitions API exists (and motion is welcome),
 * the new theme spreads out in a circle from `origin`, usually the toggle button;
 * elsewhere it switches instantly.
 */
export function changeTheme(preference: ThemePreference, origin?: { x: number; y: number }): void {
  const next = resolveTheme(preference)
  const commit = () => {
    useThemeStore.setState({ preference })
    applyTheme(next)
  }
  const current: Theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (next === current || reduceMotion || typeof document.startViewTransition !== 'function') {
    commit()
    return
  }

  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? 0
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transition = document.startViewTransition(commit)
  void transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 480, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  })
}

/** Keeps the page in step with the preference, including OS changes while on "system" and changes made in other tabs. Mount once. */
export function useThemeSync(): void {
  const preference = useThemeStore((state) => state.preference)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) void useThemeStore.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    applyTheme(resolveTheme(preference))
    if (preference !== 'system') return
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => applyTheme(resolveTheme('system'))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])
}
