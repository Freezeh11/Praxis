/** @type {import('tailwindcss').Config} */
export default {
  // Two selectors, one switch: `dark` (the class the theme store toggles on
  // <html>) and `[data-theme="dark"]` (the attribute the token layer has always
  // used). Both resolve to the same state, so `dark:` utilities and the legacy
  // token remaps can never disagree about which theme is active.
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-card': 'rgb(var(--bg-card) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-dark': 'rgb(var(--border-dark) / <alpha-value>)',
        // The workspace stepper rail: its own token because the slate remap
        // maps bg-slate-300 onto the card surface, which erased the rail in dark.
        rail: 'rgb(var(--rail) / <alpha-value>)',
        text: {
          1: 'rgb(var(--text-1) / <alpha-value>)',
          2: 'rgb(var(--text-2) / <alpha-value>)',
          3: 'rgb(var(--text-3) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        teal: {
          DEFAULT: '#0369a1',
          600: '#0f766e',
          700: '#115e59',
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
        red: { DEFAULT: '#ef4444' },
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        lg: '0 16px 40px rgba(0,0,0,0.14)',
        // Light-mode elevation ladder: a soft ambient layer (wide, very low
        // alpha) plus a tight contact layer, both slate-tinted rather than pure
        // black so a white card reads as paper on the #F7F8FC canvas instead of
        // a grey smudge. The alphas are low enough that these are imperceptible
        // on the dark canvas, so no dark: counterpart is needed.
        card: '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -16px rgba(15,23,42,0.20)',
        'card-hover': '0 2px 4px rgba(15,23,42,0.05), 0 18px 36px -18px rgba(15,23,42,0.28)',
        panel: '0 1px 2px rgba(15,23,42,0.05), 0 20px 48px -32px rgba(15,23,42,0.32)',
        lift: '0 24px 56px -28px rgba(15,23,42,0.38), 0 2px 6px rgba(15,23,42,0.05)',
        chip: '0 1px 2px rgba(15,23,42,0.06)',
        'inset-soft': 'inset 0 1px 2px rgba(15,23,42,0.05)',
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
      // Colours only by default: a blanket `transition: all` (which the old
      // DEFAULT list effectively was) makes every layout change animate, and the
      // theme switch then janks instead of snapping. Surfaces opt into
      // transform/box-shadow explicitly with `transition-surface`.
      transitionProperty: {
        DEFAULT: 'background-color, border-color, color, fill, stroke',
        colors: 'background-color, border-color, color, fill, stroke',
        surface: 'background-color, border-color, color, box-shadow, transform, opacity',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      keyframes: {
        circuitPulse: {
          '0%': { transform: 'translate3d(0,0,0) scale(0.55)', opacity: '0' },
          '10%': { opacity: '0.9' },
          '55%': { transform: 'translate3d(var(--pulse-x, 120px), var(--pulse-y, 60px), 0) scale(1)', opacity: '0.55' },
          '90%': { opacity: '0' },
          '100%': { transform: 'translate3d(calc(var(--pulse-x, 120px) * 2), calc(var(--pulse-y, 60px) * 2), 0) scale(0.55)', opacity: '0' },
        },
        gateDrift: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-10px,0)' },
        },
      },
      animation: {
        'circuit-pulse': 'circuitPulse var(--pulse-duration, 18s) linear var(--pulse-delay, 0s) infinite',
        'gate-drift': 'gateDrift 24s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
