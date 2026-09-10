/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* The application ground. Content surfaces sit on top of it in white. */
        canvas: '#f4f6f8',
        /* Single brand hue: primary actions, blood-group tags, active nav. */
        crimson: {
          50: '#fdf3f4', 100: '#fbe4e6', 200: '#f6ccd1', 300: '#eda6ae',
          400: '#e07683', 500: '#cd4b5c', 600: '#b53245', 700: '#98283a',
          800: '#7f2433', 900: '#6c2230', 950: '#3b0e16',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        surface: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        raised: '0 1px 3px 0 rgb(16 24 40 / 0.08), 0 1px 2px -1px rgb(16 24 40 / 0.06)',
      },
    },
  },
  plugins: [],
};
