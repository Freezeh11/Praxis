/** Full-width auth submit button: shows a spinner beside `busyLabel` while `loading`. */
export default function SubmitButton({ loading = false, disabled = false, busyLabel, children }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="mt-2 w-full min-h-12 py-3 bg-accent text-white rounded-lg font-bold text-[15px] transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm flex items-center justify-center gap-2"
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {loading ? busyLabel : children}
    </button>
  )
}
