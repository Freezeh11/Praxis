/**
 * TutorialToggle — the "Tutorial" on/off button of the guided walkthrough.
 * Header on the wide tiers, step-history drawer on the compact ones.
 */
export default function TutorialToggle({ compact, isTutorialActive, onToggle, chromeText, chromeHeight }) {
  return (
    <button
      className={`flex items-center justify-center gap-1.5 rounded-md border font-semibold transition-all ${compact ? `px-3 ${chromeText}` : 'px-3 py-1.5 text-xs'} ${chromeHeight} ${
        isTutorialActive
          ? 'bg-teal text-white border-teal shadow-xs'
          : 'border-border bg-bg text-text-2 hover:bg-border hover:text-text-1'
      }`}
      onClick={onToggle}
      title="Toggle Interactive Tutorial Guide"
    >
      Tutorial
    </button>
  )
}
