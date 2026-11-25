import Icon from '../ui/Icon'
import { SURVEY_URL } from '../../config/appLinks.js'

/**
 * SurveyButton — the entry point to the learner survey.
 *
 * An outbound anchor, not a router link: the survey is a Google Docs form that
 * lives outside Praxis, so it opens in a new tab and a learner's answer is
 * stored by the form rather than by our API. `compact` shrinks it to the label
 * for the tight header rails; the accessible name and the tooltip keep it
 * discoverable, and it stays >= 44px on landscape phones.
 */

const LABEL = 'Feedback'
const FULL_LABEL = 'Give Feedback'

export default function SurveyButton({ compact = false, chromeHeight = '' }) {
  return (
    <a
      data-testid="survey-button"
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={FULL_LABEL}
      title={FULL_LABEL}
      className={`shrink-0 inline-flex h-9 select-none items-center justify-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 text-[13px] font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20 [@media(max-height:480px)]:h-11 ${chromeHeight}`}
    >
      <span aria-hidden="true" className="shrink-0 text-[14px] leading-none"><Icon name="clipboard" /></span>
      <span className="whitespace-nowrap tracking-wide">
        {compact ? LABEL : FULL_LABEL}
      </span>
    </a>
  )
}
