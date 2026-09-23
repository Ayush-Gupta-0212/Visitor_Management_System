import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * tailwind-merge only knows Tailwind's default scale names, so it must be told
 * about the design-system tokens. Otherwise it misreads them: `text-body-md`
 * looks like a text colour, so cn('text-body-md', 'text-foreground') would drop
 * the font size. Keep these lists in sync with tailwind.config.js.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'headline-xl',
        'headline-xl-mobile',
        'headline-lg',
        'headline-md',
        'body-lg',
        'body-md',
        'body-sm',
        'label-md',
        'label-sm',
        'mono-metric',
        'mono-code',
      ],
      shadow: ['hairline', 'raised', 'overlay'],
      blur: ['overlay'],
      animate: ['fade-in', 'fade-out', 'pop-in', 'pop-out', 'slide-in', 'slide-out', 'row-in', 'rise-in'],
      spacing: [
        'space-xxs',
        'space-xs',
        'space-sm',
        'space-md',
        'space-lg',
        'space-xl',
        'space-2xl',
        'gutter',
        'gutter-desktop',
        'margin',
        'margin-tablet',
        'margin-desktop',
        'rail',
        'dock',
      ],
    },
  },
})

/** Joins class names; when Tailwind utilities conflict, the later one wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Random v4 UUID. `crypto.randomUUID` only exists on secure origins, so this falls
 * back to `getRandomValues` when the app is opened over plain HTTP (e.g. a LAN IP).
 */
export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
