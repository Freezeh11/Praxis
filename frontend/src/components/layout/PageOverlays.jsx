import LawsDrawer from '../laws/LawsDrawer'
import TutorialReplayModal from '../tutorial/TutorialReplayModal'

/**
 * The two overlays every level screen ends with — the tutorial-replay prompt and the law
 * reference drawer. Presentational: visibility, data and the measured placement are props.
 */
export default function PageOverlays({
  showTutorialPrompt,
  onCloseTutorialPrompt,
  dontAskTutorialAgain,
  onDontAskAgainChange,
  onRestartTutorial,
  shift,
  placement,
  showLawsDrawer,
  onCloseLawsDrawer,
  laws,
}) {
  return (
    <>
      {/* ── TUTORIAL REPLAY MODAL BEFORE ENTERING LEVEL 0 ── */}
      <TutorialReplayModal
        show={showTutorialPrompt}
        onClose={onCloseTutorialPrompt}
        dontAskAgain={dontAskTutorialAgain}
        onDontAskAgainChange={onDontAskAgainChange}
        shift={shift}
        onRestart={onRestartTutorial}
      />

      {/* ── LAWS DRAWER (SLIDING OVERLAY) ── */}
      <LawsDrawer
        show={showLawsDrawer}
        onClose={onCloseLawsDrawer}
        laws={laws}
        placement={placement}
      />
    </>
  )
}
