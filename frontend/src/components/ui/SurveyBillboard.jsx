/**
 * SurveyBillboard — High-visibility "ad billboard" banner inviting learners
 * to share feedback through the external survey.
 *
 * Clean presentational component linking directly to SURVEY_URL.
 */
import { SURVEY_URL } from '../../config/appLinks.js'

export default function SurveyBillboard({ className = '' }) {
  return (
    <aside
      aria-label="Learner Feedback Survey"
      className={`relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-amber-300/90 bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-amber-400 ${className}`}
    >
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-200/40 blur-2xl" />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xl shadow-xs">
            📝
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-amber-800/80">5-10 minutes</span>
            </div>

            <h3 className="mt-1 text-sm sm:text-base font-bold text-text-1">
              Help Shape the Future of Praxis!
            </h3>
            <p className="mt-0.5 text-xs text-text-2 leading-relaxed max-w-xl">
              Tell us how you learn Boolean algebra, what was tricky, and what you’d like to see next. Your feedback directly guides new levels and features.
            </p>
          </div>
        </div>

        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 self-start sm:self-center inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 font-sans text-xs sm:text-sm font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-600 hover:shadow active:scale-[0.98] transition-all cursor-pointer ring-1 ring-amber-400/50"
        >
          <span>Take the Survey</span>
          <span aria-hidden="true" className="text-sm">→</span>
        </a>
      </div>
    </aside>
  )
}
