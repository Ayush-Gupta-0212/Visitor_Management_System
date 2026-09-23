/**
 * Theme for the "Precision Enterprise VMS" design system, extracted from Google
 * Stitch project 7446685014118773496 (its DESIGN.md plus the generated screens).
 *
 * Tailwind v4 is CSS-first, so src/index.css loads this file with `@config`.
 * Colour values live there as CSS variables; this file maps them to utilities
 * and owns the static scales (type, radius, elevation, spacing, keyframes).
 *
 * Where Stitch disagrees with itself, the written DESIGN.md spec wins: the
 * auto-generated Material palette (primary #000000, bluish #f8f9ff surfaces)
 * contradicts both the spec and the project's own colour overrides.
 */

const easePrecise = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Every status family has the same roles: accent, tinted fill, text on the fill, hairline, indicator dot. */
const statusColor = (name) => ({
  DEFAULT: `var(--${name})`,
  subtle: `var(--${name}-subtle)`,
  strong: `var(--${name}-strong)`,
  border: `var(--${name}-border)`,
  dot: `var(--${name}-dot)`,
})

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: {
          DEFAULT: 'var(--surface)',
          hover: 'var(--surface-hover)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        placeholder: 'var(--placeholder)',
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)',
        },
        ring: 'var(--ring)',
        overlay: 'var(--overlay)',
        success: statusColor('success'),
        warning: statusColor('warning'),
        danger: statusColor('danger'),
        neutral: statusColor('neutral'),
      },

      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Badge IDs, timestamps, PINs, capacity ratios: all operational data.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      // Pair the mono-* sizes with `font-mono`.
      fontSize: {
        'headline-xl': ['32px', { lineHeight: '40px', letterSpacing: '-0.03em', fontWeight: '600' }],
        'headline-xl-mobile': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['18px', { lineHeight: '26px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'body-lg': ['15px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-md': ['13px', { lineHeight: '20px', letterSpacing: '-0.005em', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0em', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
        'mono-metric': ['20px', { lineHeight: '24px', letterSpacing: '-0.02em', fontWeight: '500' }],
        'mono-code': ['11px', { lineHeight: '16px', letterSpacing: '0em', fontWeight: '400' }],
      },

      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem', // segmented-control items, kbd hints
        md: '0.375rem', // form controls & buttons
        lg: '0.5rem', // cards & panels
        xl: '0.75rem', // modals & sheets
        full: '9999px', // status pills & avatars
      },

      // Depth comes from hairlines and tonal planes, not heavy drop shadows.
      boxShadow: {
        hairline: '0 1px 2px 0 var(--elevation-hairline)', // active segmented tab
        raised: '0 1px 2px 0 var(--elevation-raised)', // hover micro-shadow
        overlay: '0 12px 32px -4px var(--elevation-overlay), 0 0 0 1px var(--elevation-ring)', // modals, sheets, popovers
      },

      blur: {
        overlay: '6px', // frosted scrim behind overlays
      },

      // Stitch's named spacing tokens, alongside Tailwind's 4px scale (space-md = 3, …).
      spacing: {
        'space-xxs': '0.125rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1rem',
        'space-xl': '1.5rem',
        'space-2xl': '2rem',
        gutter: '1rem',
        'gutter-desktop': '1.5rem',
        margin: '1rem',
        'margin-tablet': '1.5rem',
        'margin-desktop': '2rem',
        rail: '15rem', // collapsible navigation rail (240px)
        dock: '20rem', // real-time activity dock (320px)
      },

      // Default transition timing is set with @theme in src/index.css, not here.

      // Enter/exit motion for Radix overlays (driven by data-state). The
      // slide-* frames read --slide-x / --slide-y, which each sheet side sets.
      keyframes: {
        'fade-in': { from: { opacity: '0' } },
        'fade-out': { to: { opacity: '0' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.98)' } },
        'pop-out': { to: { opacity: '0', transform: 'scale(0.98)' } },
        'slide-in': { from: { transform: 'translate3d(var(--slide-x, 0), var(--slide-y, 0), 0)' } },
        'slide-out': { to: { transform: 'translate3d(var(--slide-x, 0), var(--slide-y, 0), 0)' } },
        // List rows entering after a filter change, and toasts rising into view.
        'row-in': { from: { opacity: '0', transform: 'translateY(4px)' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' } },
        // Bell nudge when a new request arrives, drifting background glow, QR scanner sweep.
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-14deg)' },
          '40%': { transform: 'rotate(11deg)' },
          '60%': { transform: 'rotate(-7deg)' },
          '80%': { transform: 'rotate(4deg)' },
        },
        float: { '0%, 100%': { transform: 'translate3d(0, 0, 0)' }, '50%': { transform: 'translate3d(0, -18px, 0)' } },
        scan: { from: { top: '10%' }, to: { top: '86%' } },
        // Stat bars filling in; the success tick drawing itself; a soft glow around live states.
        'grow-x': { from: { transform: 'scaleX(0)' } },
        draw: { from: { strokeDashoffset: '1' } },
        glow: { '0%, 100%': { opacity: '0.35', transform: 'scale(1)' }, '50%': { opacity: '0.7', transform: 'scale(1.08)' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
      },
      animation: {
        'fade-in': `fade-in 150ms ${easePrecise}`,
        'fade-out': `fade-out 120ms ${easePrecise} forwards`,
        'pop-in': `pop-in 150ms ${easePrecise}`,
        'pop-out': `pop-out 120ms ${easePrecise} forwards`,
        'slide-in': `slide-in 240ms ${easePrecise}`,
        'slide-out': `slide-out 180ms ${easePrecise} forwards`,
        'row-in': `row-in 220ms ${easePrecise} both`,
        'rise-in': `rise-in 260ms ${easePrecise} both`,
        wiggle: 'wiggle 700ms ease-in-out',
        float: 'float 9s ease-in-out infinite',
        scan: 'scan 1.6s ease-in-out infinite alternate',
        'grow-x': `grow-x 900ms ${easePrecise} both`,
        draw: `draw 600ms ${easePrecise} 150ms both`,
        glow: 'glow 2.4s ease-in-out infinite',
        shake: 'shake 400ms ease-in-out',
      },
    },
  },
}
