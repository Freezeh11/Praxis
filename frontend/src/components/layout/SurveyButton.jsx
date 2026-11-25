import { Link } from 'react-router-dom'

import Icon from '../ui/Icon'

/**
 * SurveyButton — the entry point to in-app feedback.
 *
 * A router link, not an outbound anchor: a report is typed inside Praxis and
 * stored by our own API, so there is no external form and no new tab. `compact`
 * shrinks it to an icon for the tight header rails; the accessible name and the
 * tooltip keep it discoverable, and it stays >= 44px on landscape phones.
 */

const LABEL = 'Feedback'
const FULL_LABEL = 'Give Feedback'

export default function SurveyButton({ compact = false, chromeHeight = '' }) {
  return (
    <Link
      data-testid="survey-button"
      to="/contact"
      aria-label={FULL_LABEL}
      title={FULL_LABEL}
      className={`shrink-0 inline-flex h-9 select-none items-center justify-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 text-[13px] font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20 [@media(max-height:480px)]:h-11 ${chromeHeight}`}
    >
      <span aria-hidden="true" className="shrink-0 text-[14px] leading-none"><Icon name="clipboard" /></span>
      <span className="whitespace-nowrap tracking-wide">
        {compact ? LABEL : FULL_LABEL}
      </span>
    </Link>
  )
}
