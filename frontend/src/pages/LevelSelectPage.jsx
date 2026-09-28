import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameContent } from '../state/useGameContent.js'
import { useProgress } from '../state/useProgress.js'
import { usePageOverlays } from '../hooks/usePageOverlays'
import { TIMING, TUTORIAL } from '../config/gameRules.js'
import { signOut } from '../services/authActions.js'
import { playSound, playThrottledSound, primeAudio } from '../services/soundEffects.js'
import { toast } from 'sonner'
import AppHeader from '../components/layout/AppHeader'
import BackNav from '../components/layout/BackNav'
import PageOverlays from '../components/layout/PageOverlays'
import SurveyButton from '../components/layout/SurveyButton'
import SurveyBillboard from '../components/ui/SurveyBillboard'
import PointsChip from '../components/ui/PointsChip'
import ScoreGateBar from '../components/ui/ScoreGateBar'
import SoundToggle from '../components/ui/SoundToggle'
import useSoundEnabled from '../hooks/useSoundEnabled.js'

// Level 4+ are permanently "coming soon" (no puzzles yet)
const COMING_SOON = []

/**
 * Synthetic carousel entry for Sandbox mode. It is not part of the fetched
 * level data: it has no stages and never participates in score gates or
 * progress tracking, but it rides the exact same card so it sits naturally
 * alongside the real levels.
 */
const SANDBOX_LEVEL = {
  id: 'sandbox',
  name: 'Sandbox',
  desc: 'Free practice — type your own expression',
  varCount: 4,
  puzzleCount: 0,
  isSandbox: true,
}

export default function LevelSelectPage() {
  const navigate = useNavigate()
  const { levels, laws, loading, error } = useGameContent()
  const { progress, isLevelCompleted, getLevelProgress, getStagesCompleted, resetLevelProgress, hasSeenTutorial, hasCompletedTutorial } = useProgress()
  const [selected, setSelected] = useState(0) // index into the carousel entries
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()

  // Tutorial-replay prompt, laws drawer, and the placement both are measured against.
  const {
    showTutorialPrompt, dontAskTutorialAgain, setDontAskTutorialAgain, handleTutorialClick,
    handleRestartTutorial, closeTutorialPrompt, showLawsDrawer, setShowLawsDrawer, popupPlacement,
  } = usePageOverlays({ navigate, hasSeenTutorial, resetLevelProgress })

  // Real levels plus the always-available Sandbox entry, rendered as one list.
  const entries = [...(levels || []), SANDBOX_LEVEL]

  /**
   * A level is locked if it's "coming soon" OR it requires a prerequisite
   * that hasn't been satisfied yet.
   * Level 1 and Sandbox require the full tutorial (all 4 stages completed).
   * Level 2 requires Level 1 avg score >= 80% across all stages.
   * Level 3 requires Level 2 avg score >= 80% across all stages.
   */
  const getLockState = (lv) => {
    if (!lv) return { locked: true, reason: '' }
    // Sandbox requires the full tutorial (all 4 stages completed) before it can be played.
    if (lv.isSandbox) {
      if (!hasCompletedTutorial) {
        const tutStages = TUTORIAL.stageIndexes || [0, 1, 2, 3]
        const completedStages = getStagesCompleted(0).filter((idx) => tutStages.includes(idx)).length
        return {
          locked: true,
          reason: 'tutorial-gate',
          totalStages: tutStages.length,
          completedStages,
        }
      }
      return { locked: false, reason: 'sandbox' }
    }
    if (COMING_SOON.includes(lv.id)) return { locked: true, reason: 'Coming Soon' }

    if (lv.id === 0) return { locked: false, reason: '' }

    if (lv.id === 1) {
      if (!hasCompletedTutorial) {
        const tutStages = TUTORIAL.stageIndexes || [0, 1, 2, 3]
        const completedStages = getStagesCompleted(0).filter((idx) => tutStages.includes(idx)).length
        return {
          locked: true,
          reason: 'tutorial-gate',
          totalStages: tutStages.length,
          completedStages,
        }
      }
      return { locked: false, reason: '' }
    }

    if (lv.id === 2) {
      const lvl1 = levels.find(l => l.id === 1)
      const totalStages = lvl1?.puzzleCount ?? lvl1?.puzzles?.length ?? 12
      const p = getLevelProgress(1, totalStages)
      if (p.unlocked) return { locked: false, reason: '' }
      return {
        locked: true,
        reason: 'score-gate',
        progress: p,
        totalStages,
        reqLevel: 1,
      }
    }

    if (lv.id === 3) {
      const lvl2 = levels.find(l => l.id === 2)
      const totalStages = lvl2?.puzzleCount ?? lvl2?.puzzles?.length ?? 12
      const p = getLevelProgress(2, totalStages)
      if (p.unlocked) return { locked: false, reason: '' }
      return {
        locked: true,
        reason: 'score-gate',
        progress: p,
        totalStages,
        reqLevel: 2,
      }
    }

    return { locked: false, reason: '' }
  }

  const handleStart = () => {
    const lv = entries[selected]
    if (!lv) return
    const { locked } = getLockState(lv)
    if (locked) return
    // Choosing a level is the navigate action: one affirmative cue, and the
    // gesture that unlocks audio for it (this screen has no puzzle to prime).
    primeAudio()
    playSound('enter')
    // Sandbox opens the workspace directly: it has no stage-selection screen.
    if (lv.isSandbox) {
      navigate('/sandbox')
      return
    }
    navigate(`/level/${lv.id}/stages`)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast.info('You have been securely logged out.')
      // Wait a moment for Better Auth's global state to clear before routing
      setTimeout(() => navigate('/'), TIMING.signOutRedirectMs)
    } catch {
      toast.error('Failed to log out.')
    }
  }

  const prev = () => {
    primeAudio()
    setSelected(s => Math.max(0, s - 1))
  }
  const next = () => {
    primeAudio()
    setSelected(s => Math.min(entries.length - 1, s + 1))
  }

  /**
   * Carousel feedback.
   *
   * The cue follows the VALUE of `selected`, not each control: arrows, card
   * taps and whatever gets added later (dots, swipe, arrow keys) all funnel
   * through setSelected, so one effect covers every input path without a sound
   * call per handler. The ref holds the last index that was cued, which keeps
   * the first render silent and a re-render with an unchanged index silent —
   * a cue can never come from a render.
   *
   * playThrottledSound, not playSound: a fast burst of taps (or a future swipe)
   * changes the index many times in a few hundred ms, and one tick per change
   * is unbearable. SOUND.throttleMs owns the rate; the cue name owns nothing else.
   */
  const cuedIndexRef = useRef(selected)
  useEffect(() => {
    if (cuedIndexRef.current === selected) return
    cuedIndexRef.current = selected
    playThrottledSound('levelNav')
  }, [selected])

  /**
   * Carousel centring.
   *
   * On a phone the five-entry row (5 x 240px + gaps) is far wider than the
   * viewport, so the track clips it. Flex-centring then leaves whichever card
   * happens to sit in the middle under the spotlight — on a 420px window that
   * was Level 2 while the *selected* entry (Level 1 / Sandbox) sat off-screen,
   * which is why the arrows and the CTA looked broken.
   *
   * The row is translated so the selected card is centred. `offsetLeft` is used
   * instead of getBoundingClientRect because it ignores the current transform,
   * which keeps the maths stable across re-measures. When the row fits inside
   * the track (every desktop width) maxShift is 0 and the row never moves, so
   * the pre-mobile layout is untouched.
   */
  const trackRef = useRef(null)
  const rowRef = useRef(null)
  const cardRefs = useRef([])
  const [rowShift, setRowShift] = useState(0)

  const recenterRow = useCallback(() => {
    const track = trackRef.current
    const row = rowRef.current
    const card = cardRefs.current[selected]
    if (!track || !row || !card) return
    const maxShift = Math.max(0, (row.offsetWidth - track.clientWidth) / 2)
    const wanted = row.offsetWidth / 2 - (card.offsetLeft + card.offsetWidth / 2)
    const nextShift = Math.round(Math.max(-maxShift, Math.min(maxShift, wanted)))
    setRowShift(prevShift => (Math.abs(prevShift - nextShift) < 1 ? prevShift : nextShift))
  }, [selected])

  useLayoutEffect(() => {
    recenterRow()
  }, [recenterRow, entries.length, loading])

  useEffect(() => {
    window.addEventListener('resize', recenterRow)
    window.addEventListener('orientationchange', recenterRow)
    return () => {
      window.removeEventListener('resize', recenterRow)
      window.removeEventListener('orientationchange', recenterRow)
    }
  }, [recenterRow])

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg flex flex-col relative overflow-x-hidden overflow-y-auto bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      {/* Header — shrinks to 52px on a landscape phone so the card + CTA fit. */}
      <AppHeader
        left={<BackNav variant="home" to="/" label="Home" title="Back to Home" />}
        right={(
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              data-popup-anchor="tutorial"
              onClick={handleTutorialClick}
              className="h-9 [@media(max-height:480px)]:h-11 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal hover:text-white transition-all shadow-xs cursor-pointer"
              title="Interactive Tutorial"
            >
              <span>Tutorial</span>
            </button>
            <button data-popup-anchor="laws" className="w-9 h-9 [@media(max-height:480px)]:w-11 [@media(max-height:480px)]:h-11 rounded-full flex items-center justify-center text-lg text-text-2 bg-transparent hover:bg-border transition-all" title="Law Reference" onClick={() => { primeAudio(); setShowLawsDrawer(true) }}>📖</button>
            {/* Both keep the 36px desktop height of the rail and grow to 44px on
                a landscape phone, where the compact variant is used. */}
            <SoundToggle enabled={soundEnabled} onToggle={toggleSound} compact />
            <SurveyButton compact />
            <button 
              onClick={handleLogout}
              className="h-9 [@media(max-height:480px)]:h-11 px-3 rounded-lg flex items-center justify-center text-[13px] font-bold text-text-2 bg-bg hover:bg-border hover:text-text-1 transition-all sm:ml-1" 
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        )}
      />

      {/* Title */}
      <div className="mt-10 [@media(max-height:480px)]:mt-1.5 max-sm:mt-6 flex flex-col items-center gap-1.5">
        <h1 className="font-bold text-[32px] [@media(max-height:480px)]:text-[22px] tracking-tight text-accent">Choose Your Level</h1>
        <p className="praxis-hide-short text-[15px] text-text-3 font-medium">Each level introduces more variables and complexity</p>
      </div>

      {/* Carousel — the track clips the row; the row is translated so the
          selected card is centred (see recenterRow). */}
      <div className="flex items-center justify-center gap-3 sm:gap-8 mt-10 [@media(max-height:480px)]:mt-2 flex-1 min-h-0">
        <button
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center text-2xl font-black text-slate-700 shadow-md transition-all shrink-0 hover:not:disabled:border-accent hover:not:disabled:bg-slate-50 hover:not:disabled:text-accent hover:not:disabled:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
          onClick={prev}
          disabled={selected === 0}
          aria-label="Previous level"
        >
          <span>‹</span>
        </button>

        <div
          ref={trackRef}
          data-carousel-track="true"
          className="relative flex min-w-0 shrink items-center justify-center overflow-hidden"
        >
          <div
            ref={rowRef}
            className="relative flex shrink-0 items-center justify-center gap-5 [perspective:1000px] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${rowShift}px)` }}
          >
            {loading && <div className="text-text-2 font-medium">Loading levels…</div>}
            {error && <div className="text-red font-bold">⚠ Could not connect to server</div>}
            {!loading && !error && entries.map((lv, i) => {
              const offset = i - selected
              const lockState = getLockState(lv)
              const { locked } = lockState
              const isSandbox = Boolean(lv.isSandbox)
              const done = !isSandbox && isLevelCompleted(lv.id)
              const isActive = offset === 0
              const isComingSoon = COMING_SOON.includes(lv.id)
              const isScoreGated = lockState.reason === 'score-gate'
              const isTutorialGated = lockState.reason === 'tutorial-gate'

              return (
                <div
                  key={lv.id}
                  ref={el => { cardRefs.current[i] = el }}
                  data-level-card={lv.id}
                  data-active={isActive ? 'true' : 'false'}
                  className={`w-[240px] [@media(max-width:379px)]:w-[200px] bg-bg-card rounded-[20px] px-7 [@media(max-height:480px)]:px-4 py-9 [@media(max-height:480px)]:py-4 [@media(max-height:359px)]:py-3 flex flex-col items-center gap-2.5 [@media(max-height:480px)]:gap-1.5 transition-all duration-250 ease-out select-none
                    ${isActive ? 'border-[2.5px] border-text-1 scale-100 translate-y-0 opacity-100 shadow-md' : 'border-[1.5px] border-border scale-[0.92] translate-y-1 opacity-70 shadow-sm'}
                    ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${!locked && !isActive ? 'hover:opacity-90 hover:scale-95 hover:translate-y-0.5' : ''}
                  `}
                  onClick={() => {
                    if (isActive) {
                      if (!locked) handleStart()
                    } else {
                      // This tap IS the gesture that unlocks audio; the tick
                      // itself fires from the selected-index effect above.
                      primeAudio()
                      setSelected(i)
                    }
                  }}
                >
                  {/* Icon */}
                  <div className={`w-16 h-16 [@media(max-height:480px)]:w-12 [@media(max-height:480px)]:h-12 rounded-[14px] border-[1.5px] flex items-center justify-center font-extrabold transition-all
                    ${isActive ? 'bg-text-1 text-white border-text-1 text-[28px] [@media(max-height:480px)]:text-[22px]' : 'border-border text-[26px] [@media(max-height:480px)]:text-[20px]'}
                    ${done && !isActive ? 'bg-green-light text-green' : ''}
                    ${locked ? 'bg-bg text-text-3' : (!isActive && !done ? 'bg-bg text-text-2' : '')}
                  `}>
                    {locked ? '🔒' : isSandbox ? '🧪' : isComingSoon ? '🔒' : done ? '✓' : lv.id}
                  </div>

                  <div className={`font-bold text-text-1 tracking-[-0.3px] ${isActive ? 'text-[19px]' : 'text-[17px]'} [@media(max-height:480px)]:text-[16px]`}>{lv.name}</div>
                  <div className="text-[13px] [@media(max-height:480px)]:text-[12px] [@media(max-height:359px)]:hidden text-text-3 text-center">{lv.desc}</div>

                {/* Score gate progress for Level 2/3 */}
                {isScoreGated && isActive && lockState.progress && (
                  <div className="w-full mt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-text-2">
                      <span>{lockState.progress.completed}/{lockState.totalStages} stages</span>
                      <span>{lockState.progress.avgScore}/100 avg</span>
                    </div>
                    <ScoreGateBar score={lockState.progress.avgScore} />
                    {/* Threshold marker label */}
                    <div className="text-[10px] text-text-3 text-center font-medium">
                      Need 80% avg across all Level {lockState.reqLevel || (lv.id - 1)} stages
                    </div>
                  </div>
                )}

                {/* Tutorial gate progress for Level 1 and Sandbox */}
                {isTutorialGated && isActive && (
                  <div className="w-full mt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-text-2">
                      <span>{lockState.completedStages}/{lockState.totalStages} stages</span>
                      <span>Tutorial</span>
                    </div>
                    <ScoreGateBar score={lockState.totalStages > 0 ? (lockState.completedStages / lockState.totalStages) * 100 : 0} />
                    {/* Threshold marker label */}
                    <div className="text-[10px] text-text-3 text-center font-medium">
                      Complete all {lockState.totalStages} tutorial stages to unlock {isSandbox ? 'Sandbox' : `Level ${lv.id}`}
                    </div>
                  </div>
                )}

                {/* Level star badge if unlocked & played (excluding Tutorial) */}
                {!locked && !isComingSoon && (() => {
                  if (isSandbox) {
                    return (
                      <div className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 mt-auto flex items-center gap-1">
                        <span>🎲</span> Random Practice
                      </div>
                    )
                  }

                  if (lv.id === 0) {
                    if (done) {
                      return (
                        <div className="text-[11px] font-bold text-teal bg-teal/10 px-2.5 py-0.5 rounded-full border border-teal/30 mt-auto flex items-center gap-1">
                          <span>✓</span> Completed
                        </div>
                      )
                    }
                    return (
                      <div className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 mt-auto flex items-center gap-1">
                        <span>Guided Walkthrough</span>
                      </div>
                    )
                  }

                  const totalCount = lv.puzzleCount || lv.puzzles?.length || 12
                  const lp = getLevelProgress(lv.id, totalCount)
                  if (lp.totalStars > 0) {
                    return (
                      <div className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber/30 mt-auto flex items-center gap-1">
                        <span>★</span> {lp.totalStars} / {lp.maxStars} Stars
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Direct action button on active card */}
                {isActive && !locked && (
                  <button
                    id="start-level-btn"
                    type="button"
                    className="w-full mt-2 py-2.5 px-3 min-h-[44px] rounded-xl font-bold text-xs bg-accent text-white shadow-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStart()
                    }}
                  >
                    <span>{isSandbox ? 'ENTER SANDBOX' : 'VIEW STAGES'}</span>
                    <span>→</span>
                  </button>
                )}
                {isActive && locked && (
                  <button
                    id="start-level-btn"
                    type="button"
                    disabled
                    className="w-full mt-2 py-2.5 px-3 min-h-[44px] rounded-xl font-bold text-xs bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
                  >
                    <span>🔒 {isTutorialGated ? 'Complete Tutorial' : 'Locked'}</span>
                  </button>
                )}

                {/* Tags */}
                {isComingSoon && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">Coming Soon</div>
                )}
                {isScoreGated && !isActive && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">🔒 80% avg required</div>
                )}
                {isTutorialGated && !isActive && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">🔒 Tutorial required</div>
                )}
              </div>
            )
          })}
          </div>
        </div>

        <button
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center text-2xl font-black text-slate-700 shadow-md transition-all shrink-0 hover:not:disabled:border-accent hover:not:disabled:bg-slate-50 hover:not:disabled:text-accent hover:not:disabled:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
          onClick={next}
          disabled={selected === entries.length - 1}
          aria-label="Next level"
        >
          <span>›</span>
        </button>
      </div>

      {/* XP bar — decorative on a 320px-tall phone, where the fold wins. */}
      <div className="flex justify-center gap-3 sm:gap-4 mb-4 [@media(max-height:480px)]:mb-1 [@media(max-height:359px)]:hidden">
        <PointsChip variant="xp-bar" points={progress.points || 0} streak={progress.streak} />
      </div>

      {/* Feedback Survey Billboard */}
      <div className="flex flex-col items-center gap-3 pb-8 [@media(max-height:480px)]:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] [@media(max-height:359px)]:pb-1">
        <div className="w-full max-w-xl px-4 praxis-hide-short">
          <SurveyBillboard className="mt-1" />
        </div>
      </div>

      {/* ── OVERLAYS: TUTORIAL REPLAY PROMPT + LAWS DRAWER ── */}
      <PageOverlays
        showTutorialPrompt={showTutorialPrompt} onCloseTutorialPrompt={closeTutorialPrompt}
        dontAskTutorialAgain={dontAskTutorialAgain} onDontAskAgainChange={setDontAskTutorialAgain}
        onRestartTutorial={handleRestartTutorial} shift={popupPlacement ? popupPlacement.shift : 0}
        placement={popupPlacement} showLawsDrawer={showLawsDrawer}
        onCloseLawsDrawer={() => setShowLawsDrawer(false)} laws={laws}
      />
    </div>
  )
}
