/**
 * Full-width auth submit button: the primary gradient CTA from the design system.
 * Shows a spinner beside `busyLabel` while `loading`; dims while disabled.
 */
export default function SubmitButton({ loading = false, disabled = false, busyLabel, children }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 px-4 py-3 text-[15px] font-semibold text-white shadow-md shadow-indigo-500/20 transition-colors duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 dark:bg-indigo-600 dark:from-indigo-600 dark:to-cyan-700 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400/50 dark:focus-visible:ring-offset-[#0B0F19]"
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {loading ? busyLabel : children}
    </button>
  )
}
