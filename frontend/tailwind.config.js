/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#f0f1f5',
          100: '#d9dce8',
          200: '#b3b9d1',
          300: '#8d96ba',
          400: '#6773a3',
          500: '#41508c',
          600: '#2d3a6e',
          700: '#1B2A5E',
          800: '#15214b',
          900: '#0f1838',
        },
        brand: {
          orange: '#E87A2E',
          'orange-dark': '#C44E2A',
          'orange-light': '#F5A623',
          cream: '#F0EBE3',
          'cream-dark': '#E5DED4',
        },
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      }
    },
  },
  plugins: [],
}
