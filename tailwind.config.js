/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Single brand hue. Used for primary actions, blood-group tags, and
        // nothing else, so it keeps its weight.
        crimson: {
          50: '#fdf3f4', 100: '#fbe4e6', 200: '#f6ccd1', 300: '#eda6ae',
          400: '#e07683', 500: '#cd4b5c', 600: '#b53245', 700: '#98283a',
          800: '#7f2433', 900: '#6c2230', 950: '#3b0e16',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
