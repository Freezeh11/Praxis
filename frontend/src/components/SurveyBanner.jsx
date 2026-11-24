import { Link } from 'react-router-dom'

/**
 * SurveyBanner — the landing-page prompt to leave feedback.
 *
 * A router link into /contact: a report is typed inside the app and stored by our
 * own API, so there is no external form and nothing opens in a new tab.
 */
export default function SurveyBanner({ className = '' }) {
  return (
    <Link
      to="/contact"
      className={`inline-flex items-center gap-2.5 px-4 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border-2 border-dashed border-emerald-400/80 rounded-2xl transition-all shadow-[0_0_14px_rgba(16,185,129,0.18)] hover:shadow-[0_0_18px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 group cursor-pointer select-none ${className}`}
      title="Open the Praxis feedback form"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>

      <span className="text-xs sm:text-[13px] font-bold text-emerald-950 tracking-tight leading-tight">
        Found a bug or have an idea? Tell us in the app — it takes a minute.
      </span>

      <span className="text-emerald-700 text-xs font-bold transition-transform duration-200 group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  )
}
