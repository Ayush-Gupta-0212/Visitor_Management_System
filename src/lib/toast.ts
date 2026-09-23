import { create } from 'zustand'
import { createId } from './utils'

/*
 * A small toast queue: `toast.success('Saved')` from anywhere, rendered by the
 * <Toaster /> mounted once at the app root. Kept out of the domain store because
 * notifications are UI, not data.
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  description?: string
  action?: { label: string; onClick: () => void }
  /** Defaults to 4.5 s, or 6 s for errors. */
  durationMs?: number
}

export interface ToastItem extends ToastOptions {
  id: string
  title: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}

const MAX_VISIBLE = 4

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

function show(variant: ToastVariant, title: string, options: ToastOptions = {}): string {
  const item: ToastItem = { id: createId(), variant, title, durationMs: variant === 'error' ? 6000 : 4500, ...options }
  useToastStore.setState((state) => ({ toasts: [...state.toasts, item].slice(-MAX_VISIBLE) }))
  return item.id
}

export const toast = {
  success: (title: string, options?: ToastOptions) => show('success', title, options),
  error: (title: string, options?: ToastOptions) => show('error', title, options),
  warning: (title: string, options?: ToastOptions) => show('warning', title, options),
  info: (title: string, options?: ToastOptions) => show('info', title, options),
}
