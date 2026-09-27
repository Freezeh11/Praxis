/**
 * SurveyButton — the outbound link to the learner survey.
 *
 * A plain anchor: no router, no state, no tracking. `compact` shrinks it to an
 * icon for the tight header rails; the accessible name and the tooltip keep it
 * discoverable, and it stays >= 44px on landscape phones.
 */
import { SURVEY_URL } from '../../config/appLinks.js'

const LABEL = 'Give feedback'

export default function SurveyButton({ compact = false, chromeHeight = '' }) {
  return (
    <a
      data-testid="survey-button"
      href={SURVEY_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${LABEL} — opens the survey in a new tab`}
      title={`${LABEL} — opens the survey in a new tab`}
      className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-bg font-bold text-text-2 transition-all hover:bg-border hover:text-text-1 ${chromeHeight} ${compact
        ? 'w-9 h-9 [@media(max-height:480px)]:h-11 [@media(max-height:480px)]:w-11'
        : 'px-2.5 h-9 [@media(max-height:480px)]:h-11'}`}
    >
      <span aria-hidden="true" className="text-[15px] leading-none">📝</span>
      {!compact && <span className="hidden sm:inline whitespace-nowrap text-xs">{LABEL}</span>}
    </a>
  )
}
