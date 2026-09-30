/**
 * SurveyButton — the outbound link to the learner survey.
 *
 * A plain anchor: no router, no state, no tracking. `compact` shrinks it to an
 * icon for the tight header rails; the accessible name and the tooltip keep it
 * discoverable, and it stays >= 44px on landscape phones.
 */
import { SURVEY_URL } from '../../config/appLinks.js'

const LABEL = 'Survey'
const FULL_LABEL = 'Give Feedback'

export default function SurveyButton({ compact = false, chromeHeight = '' }) {
  return (
    <a
      data-testid="survey-button"
      href={SURVEY_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${FULL_LABEL} (opens survey in new tab)`}
      title={`${FULL_LABEL} (opens survey in new tab)`}
      className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/90 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-xs hover:shadow-md hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer ring-1 ring-amber-300/40 select-none ${chromeHeight} ${compact
        ? 'px-2.5 h-9 [@media(max-height:480px)]:h-11'
        : 'px-3 h-9 [@media(max-height:480px)]:h-11'}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
      </span>
      <span aria-hidden="true" className="text-[14px] leading-none shrink-0">📝</span>
      <span className="whitespace-nowrap tracking-wide">
        {compact ? LABEL : FULL_LABEL}
      </span>
    </a>
  )
}
