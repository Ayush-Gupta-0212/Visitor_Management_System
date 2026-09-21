/** Small shared hooks. */
import { useEffect, useRef, useState } from 'react';

/**
 * Delays a rapidly-changing value.
 *
 * The search box updates `text` on every keystroke, but re-running the query on
 * every keystroke is wasted work - a fast typist produces 8-10 changes a
 * second and only the last one matters. 250 ms is short enough to feel
 * instant and long enough to collapse a burst of typing into one query.
 */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Runs `callback` on an interval, without the stale-closure bug that a naive
 * `useEffect(() => setInterval(callback, ms), [])` would have: the interval is
 * created once, but always calls the latest callback.
 */
export function useInterval(callback: () => void, delayMs: number): void {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    const timer = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(timer);
  }, [delayMs]);
}

/** Re-renders on a timer, so relative times ("2h 15m ago") stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), intervalMs);
  return now;
}

/** Tracks the browser's online/offline state, for the connectivity banner. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
