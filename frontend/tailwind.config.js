/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f0f2f7',
        'bg-card': '#ffffff',
        border: '#e2e5ed',
        'border-dark': '#c8ccd6',
        text: {
          1: '#1a2035',
          2: '#4b5468',
          3: '#9aa0b0',
        },
        accent: '#1a2035',
        teal: {
          DEFAULT: '#0ea5e9',
          light: '#e0f4fd',
        },
        amber: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
        },
        green: {
          DEFAULT: '#10b981',
          light: '#d1fae5',
        },
        red: '#ef4444',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        lg: '0 16px 40px rgba(0,0,0,0.14)',
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      transitionProperty: {
        DEFAULT: 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, right',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
}

