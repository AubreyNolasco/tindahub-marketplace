/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware: every text-ink / bg-ink / border-ink usage across
        // the whole app (not just the new components) now resolves to the
        // same light/dark tokens as text-fg, so text stays readable
        // everywhere regardless of theme without having to migrate each
        // page individually. See src/index.css :root / .dark for values.
        ink: 'var(--fg)',
        // Always-dark, theme-independent — used for modal/drawer backdrop
        // scrims (bg-scrim/60 etc). These must stay a dark dimming layer
        // in both themes; unlike ink, they should NOT flip light in dark
        // mode (that would look like a light haze instead of a dim).
        scrim: '#0b1210',
        // Semantic surface/text tokens — resolve to CSS variables (see
        // src/index.css :root / .dark) so components built against these
        // (bg-surface, border-line, text-fg, ...) flip automatically in
        // dark mode instead of needing per-component dark: overrides.
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          inset: 'var(--surface-inset)'
        },
        line: 'var(--line)',
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)'
        },
        teal: {
          50: '#ECF8EF',
          100: '#D4EFDA',
          200: '#B7E3C2',
          300: '#83C995',
          400: '#4EAB70',
          500: '#238B57',
          600: '#16794B',
          700: '#10603D',
          800: '#0D5135',
          900: '#0B4D30',
          950: '#073B25'
        },
        mango: {
          100: '#FCEBCB',
          200: '#F9DDA7',
          300: '#F7CB7C',
          400: '#F4B954',
          500: '#F2A93B',
          600: '#D98E1F',
          700: '#A96713'
        },
        coral: {
          100: '#FADAD1',
          200: '#F5B9A8',
          500: '#E4572E',
          600: '#C6441F',
          700: '#9F3518'
        },
        cream: '#F7FAF7'
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        xl2: '1.25rem'
      },
      boxShadow: {
        soft: '0 4px 24px rgba(22, 33, 30, 0.06)',
        card: '0 2px 12px rgba(22, 33, 30, 0.08)',
        'elevation-1': 'var(--shadow-1)',
        'elevation-2': 'var(--shadow-2)',
        'elevation-3': 'var(--shadow-3)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } }
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out',
        'scale-in': 'scale-in .15s ease-out',
        'slide-up': 'slide-up .2s ease-out'
      }
    }
  },
  plugins: []
}
