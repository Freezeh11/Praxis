/** Accent loading spinner. `size` takes the Tailwind size classes (e.g. "h-8 w-8"). */
export default function LoadingSpinner({ size = 'h-8 w-8' }) {
  return (
    <svg className={`animate-spin ${size} text-accent`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
