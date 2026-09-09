/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // BloodGrid identity palette
        crimson: {
          50: '#fef2f3', 100: '#fde3e5', 200: '#fbccd1', 300: '#f7a5ae',
          400: '#f17384', 500: '#e6435c', 600: '#cf2544', 700: '#ae1837',
          800: '#921734', 900: '#7d1732', 950: '#450716',
        },
        slate: {
          850: '#172033',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        lift: '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 6px -2px rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        pulseRing: {
          '0%':   { transform: 'scale(0.85)', opacity: '0.7' },
          '70%':  { transform: 'scale(1.6)',  opacity: '0' },
          '100%': { transform: 'scale(1.6)',  opacity: '0' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite',
        fadeUp: 'fadeUp 0.35s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
