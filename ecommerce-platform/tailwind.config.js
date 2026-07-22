/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#142019',
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
        card: '0 2px 12px rgba(22, 33, 30, 0.08)'
      }
    }
  },
  plugins: []
}
