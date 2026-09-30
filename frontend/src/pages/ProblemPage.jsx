/**
 * ProblemPage: the route screen for `/level/:levelId/stage/:stageIdx` and
 * `/sandbox/play`, and the composition root of the puzzle workspace.
 *
 * Everything below it is a single-purpose module: the session (route identity,
 * puzzle loading, completion + scoring) in components/puzzle/usePuzzleSession,
 * the sandbox contract in components/puzzle/sandboxPuzzle, the collision-aware
 * popup layer in hooks/useCollisionPlacement, and one component per surface of
 * the screen. This file owns the device tier, the transient UI state and the
 * wiring between them.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import DerivationCanvas from '../components/puzzle/DerivationCanvas'
import HintBubble from '../components/puzzle/HintBubble'
import LawExplanationCard from '../components/puzzle/LawExplanationCard'
import LawPanel from '../components/puzzle/LawPanel'
import LawsReferenceSheet from '../components/puzzle/LawsReferenceSheet'
import ResetConfirmModal from '../components/puzzle/ResetConfirmModal'
import ScoreModal from '../components/puzzle/ScoreModal'
import SidePanel from '../components/puzzle/SidePanel'
import StepHistoryPanel from '../components/puzzle/StepHistoryPanel'
import StepInspectionTip from '../components/puzzle/StepInspectionTip'
import WorkspaceHeader from '../components/puzzle/WorkspaceHeader'
import MobileExpressionModal from '../components/puzzle/MobileExpressionModal'
import usePuzzleSession from '../components/puzzle/usePuzzleSession'
import InteractiveTutorial from '../components/InteractiveTutorial'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { GUIDE_COST_POINTS, TIMING, TUTORIAL } from '../config/gameRules.js'
import { SKIP_RESET_CONFIRM } from '../config/storageKeys.js'
import useBandedOverlay from '../hooks/useBandedOverlay.js'
import useCollisionPlacement, {
  CANVAS_SELECTOR,
  HINT_POPUP_CANDIDATES,
  INSPECT_POPUP_CANDIDATES,
} from '../hooks/useCollisionPlacement.js'
import useDeviceTier, { PHONE_MAX_WIDTH, SMALL_TABLET_MAX_WIDTH } from '../hooks/useDeviceTier.js'
import useSoundEnabled from '../hooks/useSoundEnabled.js'
import { primeAudio } from '../services/soundEffects.js'

/** Below this viewport height the popups switch to their compressed layout. */
const SHORT_VIEWPORT_MAX_HEIGHT = 520
/** Below this the header rail can be 3 controls wide: nothing fits beside it. */
const TINY_VIEWPORT_MAX_HEIGHT = 360

/**
 * All three non-blocking popups hang off the SAME kind of anchor: the
 * derivation line they explain (the active expression row, marked
 * `data-tutorial`). The old markup anchored them to a 24px-wide rail cell and
 * let them spill over the expression and the law dock. Resolved by selector at
 * measure time so the tier can re-home the anchor without re-registering
 * anything.
 */
const DEFAULT_INSPECT_ANCHOR = '[data-inspect-trigger], [data-tutorial="active-equation"]'
const HINT_ANCHOR = '[data-tutorial="hint-button"]'

export default function ProblemPage() {
  const navigate = useNavigate()

  // ── Device tier (Feature 2) ───────────────────────────────────────────
  // Every tier behaviour below is additive: the desktop branch keeps the exact
  // markup/classes it has always had.
  const { isTouch, isPortrait, isLandscape, isPhone, isSmallTablet, isTablet, width, height } = useDeviceTier()
  // The tier hook classifies by width, so a phone rotated to landscape (844x390)
  // reports `tablet-sm` because its long edge is > 767px. What actually decides
  // whether side columns fit is the SHORT edge, so a short touch landscape
  // viewport is treated as the phone-landscape layout regardless of that label.
  const isPhoneLandscape = isTouch && isLandscape && (isPhone || height <= 520)
  const isTabletPortrait = (isTablet || isSmallTablet) && isPortrait
  const isTabletLandscape = isTablet && isLandscape
  // A narrow viewport is a compact viewport no matter what the pointer type is:
  // a 420px desktop window must not be handed the squeezed three-column layout.
  // Non-touch windows get a wider cutoff (SMALL_TABLET_MAX_WIDTH) because below
  // 1024px the two side columns leave the canvas unusably thin; >=1024px stays
  // the full desktop three-column design. Touch keeps the phone cutoff so a
  // 768-1023px touch device keeps its own tablet rules.
  const isNarrowViewport = width > 0
    && width <= (isTouch ? PHONE_MAX_WIDTH : SMALL_TABLET_MAX_WIDTH)
  // Phone landscape / tablet portrait / any narrow window can't fit a side
  // column next to the canvas: step history becomes an overlay drawer and the
  // right panel folds into the header (assistance) or the bottom dock (laws).
  const useOverlayHistory = isPhoneLandscape || isTabletPortrait || isNarrowViewport
  const showRightPanel = !useOverlayHistory
  const lawsAsStrip = isPhoneLandscape || isNarrowViewport
  const lawsAsGrid = isTabletPortrait && !isNarrowViewport
  const lawsInRightColumn = isTabletLandscape
  const compactHeader = useOverlayHistory || isTabletLandscape
  /** Compact tiers re-home the workspace controls into a second header row. */
  const headerControlRail = useOverlayHistory
  const assistanceInHeader = useOverlayHistory
  /** Only touch tiers get enlarged hit boxes — desktop rendering is untouched. */
  const touchTargets = isTouch
  // Landscape phones (390px tall) and short windows: compress every popup so
  // its actions stay reachable without scrolling.
  const shortViewport = height > 0 && height < SHORT_VIEWPORT_MAX_HEIGHT
  // The laws reference is a full-width bottom sheet until the viewport is both
  // wide AND tall enough to deserve the side drawer.
  const lawsSheet = width > 0 && (width <= PHONE_MAX_WIDTH || shortViewport)

  // ── Transient UI state (the page owns every popup and overlay) ─────────
  const [showHint, setShowHint] = useState(false)
  const [currentHint, setCurrentHint] = useState('')
  const [zoom, setZoom] = useState(1.0)
  const [inspectedStepIdx, setInspectedStepIdx] = useState(null)
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)
  const [showStepHistory, setShowStepHistory] = useState(false)
  // Derived, never stored: the drawer cannot outlive the tier that owns it, so
  // leaving phone landscape/tablet portrait closes it without an effect.
  const stepHistoryOpen = showStepHistory && useOverlayHistory
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [dontAskResetAgain, setDontAskResetAgain] = useState(false)
  const [dismissReviewReminder, setDismissReviewReminder] = useState(false)
  const [showStepInspectionTip, setShowStepInspectionTip] = useState(false)
  const [showMobileExpressionCreator, setShowMobileExpressionCreator] = useState(false)
  const expressionInputRef = useRef(null)
  const [isTutorialActive, setIsTutorialActive] = useState(() => new URLSearchParams(window.location.search).get('tutorial') === 'true')
  // The sound preference is owned by its hook (storage + AudioContext unlock);
  // this page only hands it to the header toggle.
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()

  const handlePuzzleChange = () => setShowHint(false)
  /** A randomize swaps the problem: every transient overlay goes with it. */
  const handleWorkspaceReset = () => {
    setShowHint(false)
    setInspectedStepIdx(null)
    setShowResetConfirm(false)
  }

  /**
   * The panels cue their own open/close (hooks/usePanelSound), so these only
   * have to unlock audio: a learner whose first action is opening the laws or
   * the step history has not clicked a term yet, and an unprimed AudioContext
   * would swallow the cue.
   */
  const openLaws = () => {
    primeAudio()
    setShowLawsDrawer(true)
  }
  const toggleStepHistory = () => {
    primeAudio()
    setShowStepHistory(prev => !prev)
  }
  const openStepHistory = () => {
    primeAudio()
    setShowStepHistory(true)
  }

  const {
    levelId, stageIdx, isSandbox, isCustomSandbox, customPuzzle, level, puzzle, sandboxNonce,
    stageNum, completedSet, showSuccess, setShowSuccess, scoreResult, setScoreResult,
    handleOpenScoreSummary, handleRandomize, handleLoadCustomExpression, clearLoadedAsSaved, progress, deductPoints, laws,
    expr, sel, steps, applicableLaws, isComplete, earnedXp, status, statusMsg,
    activeGuidePaths, isPreLawHighlight, isAnimating, animationData,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, requestHint, swapTerms, activateGuide,
    hintsUsed, guidesUsed, optimalSteps,
  } = usePuzzleSession({ onPuzzleChange: handlePuzzleChange, onWorkspaceReset: handleWorkspaceReset })

  const handleNewExpression = () => {
    setShowSuccess(false)
    if (showRightPanel) {
      expressionInputRef.current?.focus()
      expressionInputRef.current?.select()
    } else {
      setShowMobileExpressionCreator(true)
    }
  }

  const isTutorialLevel = !isSandbox && Number(levelId) === TUTORIAL.levelId

  // The compact tiers scroll/crop the derivation inside this box, so a popup
  // that can leave it at all should. A 568x320 phone has no free band left
  // once the header rail is counted, so there the canvas becomes a soft
  // obstacle (costed) instead of a hard one and the card is allowed to sit on
  // the expression rather than on a control the learner still needs.
  const compactCanvas = shortViewport || isNarrowViewport || isPhoneLandscape || isTabletPortrait
  const canvasIsHardObstacle = compactCanvas && !(height > 0 && height <= TINY_VIEWPORT_MAX_HEIGHT)

  const inspectAnchorSelector = inspectedStepIdx !== null
    ? `[data-inspect-step="${inspectedStepIdx}"], [data-inspect-anchor="true"]`
    : DEFAULT_INSPECT_ANCHOR

  const {
    nodeRef: inspectPopupNode,
    layerStyle: inspectPopupStyle,
    ready: inspectPopupReady,
  } = useCollisionPlacement({
    anchorSelector: inspectAnchorSelector,
    candidates: INSPECT_POPUP_CANDIDATES,
    fullWidthOnNarrow: 480,
    enabled: inspectedStepIdx !== null || showStepInspectionTip,
  })

  const {
    nodeRef: lawsPanelNode,
    band: lawsPanelBand,
    ready: lawsPanelReady,
  } = useBandedOverlay(
    // The panel hangs under whichever control opened it — the header rail button
    // on the compact tiers, the right panel's Laws Quick Reference on the wide
    // ones — so it never buries its own trigger.
    ['[data-testid="laws-sheet-anchor"]', '[data-tutorial="laws-reference-button"]'],
    showLawsDrawer,
  )

  const {
    nodeRef: hintPopupNode,
    layerStyle: hintPopupStyle,
    ready: hintPopupReady,
  } = useCollisionPlacement({
    anchorSelector: HINT_ANCHOR,
    candidates: HINT_POPUP_CANDIDATES,
    hardAvoidSelector: canvasIsHardObstacle ? CANVAS_SELECTOR : null,
    softAvoidSelector: compactCanvas ? CANVAS_SELECTOR : null,
    fullWidthOnNarrow: 480,
    enabled: showHint,
  })

  // Reset review reminder and inspection tip on stage changes
  useEffect(() => {
    setDismissReviewReminder(false)
    setShowStepInspectionTip(false)
  }, [levelId, stageIdx])

  // Dismiss inspection tip whenever a step is actively inspected
  useEffect(() => {
    if (inspectedStepIdx !== null) {
      setShowStepInspectionTip(false)
    }
  }, [inspectedStepIdx])

  // Sync tutorial active state from URL query or tutorial level; the sandbox
  // and non-tutorial levels never run the guided tutorial overlay.
  useEffect(() => {
    if (!isTutorialLevel) {
      setIsTutorialActive(false)
      return
    }
    const isTutQuery = new URLSearchParams(window.location.search).get('tutorial') === 'true'
    const isTutLevel = Number(levelId) === TUTORIAL.levelId
    setIsTutorialActive(isTutQuery || isTutLevel)
  }, [levelId, stageIdx, isSandbox, isTutorialLevel])

  // Global click-away listener for derivation step inspection
  useEffect(() => {
    if (inspectedStepIdx === null) return
    const handlePointerDown = (e) => {
      if (
        e.target.closest('[data-inspect-card]') ||
        e.target.closest('[data-inspect-trigger]') ||
        e.target.closest('[data-inspect-anchor]') ||
        e.target.closest('[data-tutorial="step-history-panel"]') ||
        e.target.closest('[data-testid="step-history-toggle"]') ||
        e.target.closest('[data-tutorial^="step-history-card-"]')
      ) {
        return
      }
      setInspectedStepIdx(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [inspectedStepIdx])

  const handleHint = () => {
    if (!puzzle || isComplete) return
    const hint = requestHint(puzzle)
    if (hint) {
      setCurrentHint(hint)
      setShowHint(true)
      setTimeout(() => setShowHint(false), TIMING.hintAutoDismissMs)
    }
  }

  const handleNextStage = () => {
    const nextIdx = stageNum + 1
    if (level && nextIdx < level.puzzles.length) {
      const isTutLevel = Number(levelId) === TUTORIAL.levelId
      const tutParam = isTutLevel ? '?tutorial=true' : ''
      navigate(`/level/${levelId}/stage/${nextIdx}${tutParam}`)
    } else {
      if (Number(levelId) === TUTORIAL.levelId) {
        setIsTutorialActive(false)
      }
      navigate(`/level/${levelId}/stages`)
    }
  }

  const handleSelectStage = (idx) => {
    if (!levelId) return
    const isTutLevel = Number(levelId) === TUTORIAL.levelId
    const tutParam = isTutLevel ? '?tutorial=true' : ''
    navigate(`/level/${levelId}/stage/${idx}${tutParam}`)
  }

  // The Guide is a graded-level aid: 20 points there, free in the unscored
  // sandbox (the spec requires Hint/Guide to stay available while practicing).
  const guideCost = isSandbox ? 0 : GUIDE_COST_POINTS

  const handleGuide = () => {
    if (isComplete) return
    if (guideCost === 0 || (progress.points ?? 0) >= guideCost) {
      const activated = activateGuide()
      if (activated && guideCost > 0) {
        deductPoints(guideCost)
      }
    } else {
      toast.error(`Not enough points! You need ${guideCost} points to use the Guide.`)
    }
  }

  const handleResetClick = () => {
    // If the stage is completed and user hasn't opted out in this session
    const skipPrompt = sessionStorage.getItem(SKIP_RESET_CONFIRM) === 'true'
    if (isComplete && !skipPrompt) {
      setDontAskResetAgain(false)
      setShowResetConfirm(true)
    } else {
      executeReset()
    }
  }

  const executeReset = () => {
    if (dontAskResetAgain) {
      sessionStorage.setItem(SKIP_RESET_CONFIRM, 'true')
    }
    setInspectedStepIdx(null)
    clearLoadedAsSaved()
    setShowResetConfirm(false)
    setShowSuccess(false)
    setShowHint(false)
    resetPuzzle(puzzle)
  }

  const handleUndo = () => {
    setInspectedStepIdx(null)
    clearLoadedAsSaved()
    undoAction()
  }

  /* Wrapper functions to pass current expr snapshot to handlers */
  const onClickLit = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickLit(path, expr)
  }
  const onClickNot = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickNot(path, expr)
  }
  const onClickTerm = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickTerm(path, expr)
  }
  const onApplyLaw = (law) => {
    setInspectedStepIdx(null)
    clearLoadedAsSaved()
    const enableTutorialPause = isTutorialActive && stageNum < 3
    if (expr) applyLaw(law, expr, steps, hintsUsed, enableTutorialPause)
  }

  const handleTutorialToggle = () => {
    if (!isTutorialLevel) return
    setIsTutorialActive(prev => {
      const next = !prev
      if (next && puzzle) {
        clearLoadedAsSaved()
        setShowSuccess(false)
        setShowHint(false)
        setScoreResult(null)
        resetPuzzle(puzzle)
      }
      return next
    })
  }

  if (!level || !puzzle) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="h-7 w-7" />
          <span className="text-sm font-semibold text-text-3">{isSandbox ? 'Generating problem...' : 'Loading stage...'}</span>
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────────────────
     Tier-dependent placement of the shared blocks. Wide tiers render these
     exactly where they have always been; the touch tiers re-home them so the
     canvas keeps its full width and every control stays thumb-reachable.
     ────────────────────────────────────────────────────────────────────── */

  const chromeText = touchTargets ? 'text-[14px]' : 'text-xs'
  const chromeHeight = touchTargets ? 'min-h-[44px] min-w-[44px] praxis-touch-target' : ''

  /**
   * Applicable-laws / completion panel. It sits under the canvas on every
   * tier except a landscape tablet, where it becomes the right column so the
   * laws stay visible next to the expression.
   */
  const lawsPanel = (
    <LawPanel
      isComplete={isComplete} isSandbox={isSandbox} isCustomSandbox={isCustomSandbox}
      steps={steps} optimalSteps={optimalSteps} applicableLaws={applicableLaws}
      sel={sel} lawsAsStrip={lawsAsStrip} lawsAsGrid={lawsAsGrid}
      touchTargets={touchTargets} onApplyLaw={onApplyLaw} onOpenLaws={openLaws}
      level={level} stageNum={stageNum} onOpenScoreSummary={handleOpenScoreSummary}
      onNextStage={handleNextStage} onBackToStages={() => navigate(`/level/${levelId}/stages`)} onRandomize={handleRandomize}
      onNewExpression={handleNewExpression}
    />
  )

  return (
    <div className={isPhoneLandscape ? 'flex h-[100dvh] overflow-hidden bg-bg' : 'flex h-screen overflow-hidden bg-bg'}>
      <StepHistoryPanel
        steps={steps} inspectedStepIdx={inspectedStepIdx} onToggleInspectStep={setInspectedStepIdx}
        useOverlayHistory={useOverlayHistory} isPhoneLandscape={isPhoneLandscape} stepHistoryOpen={stepHistoryOpen}
        onCloseStepHistory={() => setShowStepHistory(false)} isSandbox={isSandbox} onBack={() => navigate(isSandbox ? '/levels' : `/level/${levelId}/stages`)}
        touchTargets={touchTargets} zoom={zoom} onZoom={setZoom}
        isTutorialActive={isTutorialActive} isTutorialLevel={isTutorialLevel} onToggleTutorial={handleTutorialToggle} chromeText={chromeText}
        chromeHeight={chromeHeight}
      />

      {/* ── CENTER PANEL: Expression Workspace ── */}
      <main className={`flex-1 flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden ${isPhoneLandscape ? 'm-1.5' : 'm-3'}`}>
        <WorkspaceHeader
          isSandbox={isSandbox} isCustomSandbox={isCustomSandbox} compactHeader={compactHeader}
          headerControlRail={headerControlRail} showStepHistoryToggle={useOverlayHistory} chromeText={chromeText}
          chromeHeight={chromeHeight} steps={steps} optimalSteps={optimalSteps}
          points={progress.points} zoom={zoom} onZoom={setZoom}
          isTutorialActive={isTutorialActive} isTutorialLevel={isTutorialLevel} onToggleTutorial={handleTutorialToggle} isComplete={isComplete}
          guideCost={guideCost} onHint={handleHint} onGuide={handleGuide}
          onOpenLaws={openLaws} onBack={() => navigate(isSandbox ? '/levels' : `/level/${levelId}/stages`)} stepHistoryOpen={stepHistoryOpen}
          onToggleStepHistory={toggleStepHistory} onRandomize={handleRandomize} onNewExpression={handleNewExpression}
          onUndo={handleUndo} onReset={handleResetClick}
          soundEnabled={soundEnabled} onToggleSound={toggleSound}
        />

        <DerivationCanvas
          expr={expr} sel={sel} steps={steps}
          status={status} statusMsg={statusMsg} isAnimating={isAnimating}
          animationData={animationData} inspectedStepIdx={inspectedStepIdx} setInspectedStepIdx={setInspectedStepIdx}
          activeGuidePaths={activeGuidePaths} onClickLit={onClickLit} onClickNot={onClickNot}
          onClickTerm={onClickTerm} swapTerms={swapTerms} touchTargets={touchTargets}
          isPhoneLandscape={isPhoneLandscape} isSandbox={isSandbox} sandboxNonce={sandboxNonce}
          isCustomSandbox={isCustomSandbox} customPuzzle={customPuzzle} zoom={zoom}
        />

        {!lawsInRightColumn && lawsPanel}
      </main>

      <SidePanel
        showRightPanel={showRightPanel} lawsInRightColumn={lawsInRightColumn} lawsPanel={lawsPanel}
        isSandbox={isSandbox} isCustomSandbox={isCustomSandbox} level={level}
        stageNum={stageNum} completedSet={completedSet} points={progress.points}
        steps={steps} optimalSteps={optimalSteps} isComplete={isComplete}
        showSuccess={showSuccess} dismissReviewReminder={dismissReviewReminder} onDismissReviewReminder={() => setDismissReviewReminder(true)}
        isTutorialActive={isTutorialActive} isTutorialLevel={isTutorialLevel} onSelectStage={handleSelectStage} onNavigateStages={() => navigate(`/level/${levelId}/stages`)}
        assistanceInHeader={assistanceInHeader} guideCost={guideCost} onHint={handleHint}
        onGuide={handleGuide} onOpenLaws={openLaws} onRandomize={handleRandomize}
        onLoadCustomExpression={handleLoadCustomExpression} expressionInputRef={expressionInputRef}
        chromeText={chromeText} chromeHeight={chromeHeight}
      />

      <LawsReferenceSheet
        show={showLawsDrawer} lawsSheet={lawsSheet} laws={laws}
        nodeRef={lawsPanelNode} band={lawsPanelBand} ready={lawsPanelReady}
        onClose={() => setShowLawsDrawer(false)}
      />

      <ScoreModal
        showSuccess={showSuccess} onClose={() => setShowSuccess(false)} isTutorialActive={isTutorialActive}
        shortViewport={shortViewport} isSandbox={isSandbox} isCustomSandbox={isCustomSandbox}
        steps={steps} optimalSteps={optimalSteps} hintsUsed={hintsUsed}
        guidesUsed={guidesUsed} scoreResult={scoreResult} earnedXp={earnedXp}
        puzzle={puzzle} level={level} stageNum={stageNum}
        onNewExpression={handleNewExpression} onRandomize={handleRandomize} onNextStage={handleNextStage}
        onBackToStages={() => navigate(`/level/${levelId}/stages`)} onReset={executeReset}
      />

      {isSandbox && (
        <MobileExpressionModal
          show={showMobileExpressionCreator}
          onClose={() => setShowMobileExpressionCreator(false)}
          onLoadCustomExpression={handleLoadCustomExpression}
          onRandomize={handleRandomize}
        />
      )}

      <ResetConfirmModal
        show={showResetConfirm} shortViewport={shortViewport} isSandbox={isSandbox}
        dontAskResetAgain={dontAskResetAgain} onToggleDontAsk={setDontAskResetAgain} onClose={() => setShowResetConfirm(false)}
        onConfirm={executeReset}
      />

      {/* ── NON-BLOCKING POPUP LAYER ──
           Hint bubble + step-inspection tip + law-explanation card. One fixed
           layer, collision-aware, clamped into the viewport, never over the
           controls the learner still needs (see useCollisionPlacement). */}
      <HintBubble
        show={showHint} hint={currentHint} isPhoneLandscape={isPhoneLandscape}
        isNarrowViewport={isNarrowViewport} ready={hintPopupReady} nodeRef={hintPopupNode}
        layerStyle={hintPopupStyle} onClose={() => setShowHint(false)}
      />

      <div
        data-testid="inspect-popup-layer"
        style={{ ...inspectPopupStyle, pointerEvents: 'none' }}
        aria-hidden={!showStepInspectionTip && inspectedStepIdx === null}
        onClick={e => e.stopPropagation()}
      >
        <div ref={inspectPopupNode}>
          <AnimatePresence>
            {/* Law explanation — opened by clicking a past step / its connector. */}
            {inspectedStepIdx !== null && (
              <LawExplanationCard
                lawName={steps[inspectedStepIdx]?.law}
                ready={inspectPopupReady} onClose={() => setInspectedStepIdx(null)}
              />
            )}

            {/* First-run hint that a past step can be inspected. */}
            {showStepInspectionTip && inspectedStepIdx === null && (
              <StepInspectionTip
                ready={inspectPopupReady}
                onDismiss={() => setShowStepInspectionTip(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── INTERACTIVE TUTORIAL OVERLAY ── */}
      {isTutorialLevel && isTutorialActive && (
        <InteractiveTutorial
          stageIdx={stageNum} sel={sel} steps={steps}
          expr={expr} applicableLaws={applicableLaws} isComplete={isComplete}
          isPreLawHighlight={isPreLawHighlight} isAnimating={isAnimating} showSuccess={showSuccess}
          onResetStage={executeReset}
          onNextStage={() => {
            setShowStepHistory(false)
            if (stageNum + 1 < (level?.puzzles?.length || 4)) {
              navigate(`/level/0/stage/${stageNum + 1}?tutorial=true`)
            } else {
              setIsTutorialActive(false)
              navigate('/level/0/stages')
            }
          }}
          onFinish={() => {
            setIsTutorialActive(false)
            setShowStepHistory(false)
            if (stageNum === 1) {
              setShowStepInspectionTip(true)
            }
            if (stageNum + 1 >= (level?.puzzles?.length || 4)) {
              navigate('/levels')
            }
          }}
          onSkip={() => {
            setIsTutorialActive(false)
            setShowStepHistory(false)
            navigate('/level/0/stages')
          }}
          onOpenStepHistory={openStepHistory}
        />
      )}
    </div>
  )
}
