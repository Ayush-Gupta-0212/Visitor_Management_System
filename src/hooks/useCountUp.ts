import { useEffect, useRef, useState } from 'react'

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3

/**
 * Animates a displayed number toward `target`: from 0 on mount, then from the current
 * figure whenever the target changes. Snaps straight there when motion is reduced.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    const from = shownRef.current
    if (from === target) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs
    const startedAt = performance.now()
    let frame = requestAnimationFrame(function tick(time) {
      const progress = duration === 0 ? 1 : Math.min(1, Math.max(0, time - startedAt) / duration)
      const next = Math.round(from + (target - from) * easeOutCubic(progress))
      shownRef.current = next
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return shown
}
