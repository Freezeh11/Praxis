import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import logoFull from '../assets/logo-full.png'
import { useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import { signOut } from '../lib/auth-client'
import { toast } from 'sonner'

// Level 4+ are permanently "coming soon" (no puzzles yet)
const COMING_SOON = []

/**
 * Synthetic carousel entry for Sandbox mode. It is not part of the fetched
 * level data — it has no stages and never participates in score gates or
 * progress tracking — but it rides the exact same card so it sits naturally
 * alongside the real levels.
 */
const SANDBOX_LEVEL = {
  id: 'sandbox',
  name: 'Sandbox',
  desc: 'Free practice — type your own expression',
  varCount: 3,
  puzzleCount: 0,
  isSandbox: true,
}

/**
 * Shared placement helper for this screen's two overlays.
 *
 * The tutorial-replay prompt used to be a plain centred dialog, so on a short
 * landscape phone it covered the header button that opened it; the law drawer
 * was a full-height panel, so it hid the whole header rail. Both now measure
 * the control they belong to and stay clear of it:
 *
 *   band   → the free strip below that control (`top` + `maxHeight`)
 *   shift  → a vertical nudge that moves a centred dialog clear of it,
 *            clamped to the viewport so the dialog can never be pushed off.
 */
function usePopupPlacement(anchorSelector, active) {
  const [placement, setPlacement] = useState(null)

  useEffect(() => {
    if (!active) return undefined
    let frame = null

    const measure = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight
      const MARGIN = 8
      const anchorEl = document.querySelector(anchorSelector)
      const ar = anchorEl ? anchorEl.getBoundingClientRect() : null
      const anchorBottom = ar ? ar.bottom : 0

      // Drawer band: everything under the control, capped so it stays a
      // drawer and never swallows the page.
      const drawerTop = MARGIN
      // The drawer may be tall, but its left edge must stay clear of the header
      // controls, so a wide viewport gives it a column that starts after them
      // and a narrow one gives it the full width under them.
      const margin = 96
      const narrow = window.innerWidth <= 640
      const maxWidth = narrow
        ? window.innerWidth - MARGIN * 2
        : Math.max(260, window.innerWidth - Math.max(0, (document.querySelector(anchorSelector)?.getBoundingClientRect().left ?? 0) - 24))
      const aboveTrigger = Math.max(0, anchorBottom + MARGIN - drawerTop)
      const fullHeight = (vh - drawerTop - MARGIN) * 0.9
      const band = {
        top: drawerTop,
        maxHeight: Math.max(margin, Math.min(fullHeight, narrow ? aboveTrigger : Math.max(aboveTrigger, fullHeight * 0.7))),
        maxWidth,
      }

      // Centred dialog: keep it vertically centred unless that would cover the
      // control, then slide it down just enough.
      const panel = document.querySelector('[data-popup-panel="centered"]')
      let shift = 0
      if (panel) {
        const naturalH = panel.offsetHeight || 0
        const maxH = Math.max(120, vh - MARGIN * 2)
        const height = Math.min(naturalH, maxH)
        if (naturalH > 0 && anchorBottom + MARGIN > (vh - height) / 2) {
          shift = Math.min(anchorBottom + MARGIN - (vh - height) / 2, Math.max(0, vh - MARGIN - ((vh - height) / 2 + height)))
        }
      }
      publish({ band, shift })
    }

    const publish = (next) => {
      setPlacement(prev => (prev
        && Math.abs(prev.band.top - next.band.top) < 0.6
        && Math.abs(prev.band.maxHeight - next.band.maxHeight) < 0.6
        && Math.abs(prev.shift - next.shift) < 0.6
        ? prev
        : next))
    }
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [anchorSelector, active])

  return placement
}

export default function LevelSelectPage() {
  const navigate = useNavigate()
  const { levels, laws, loading, error } = useApi()
  const { progress, isLevelCompleted, getLevelProgress, getSavedSolution, getStagesCompleted, resetLevelProgress, hasSeenTutorial } = useProgress()
  const [selected, setSelected] = useState(0) // index into the carousel entries
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [dontAskTutorialAgain, setDontAskTutorialAgain] = useState(false)

  // Each overlay belongs to the control that opened it, so its band/shift is
  // measured against that control.
  const popupAnchorSelector = showLawsDrawer ? '[data-popup-anchor="laws"]' : '[data-popup-anchor="tutorial"]'
  const popupPlacement = usePopupPlacement(popupAnchorSelector, showTutorialPrompt || showLawsDrawer)

  // Real levels plus the always-available Sandbox entry, rendered as one list.
  const entries = [...(levels || []), SANDBOX_LEVEL]

  const handleTutorialClick = () => {
    const skipPrompt = sessionStorage.getItem('praxis_skip_tutorial_replay_prompt') === 'true'

    if (hasSeenTutorial && !skipPrompt) {
      setDontAskTutorialAgain(false)
      setShowTutorialPrompt(true)
    } else {
      navigate('/level/0/stage/0?tutorial=true')
    }
  }

  const handleRestartTutorial = () => {
    if (dontAskTutorialAgain) {
      sessionStorage.setItem('praxis_skip_tutorial_replay_prompt', 'true')
    }
    resetLevelProgress(0)
    setShowTutorialPrompt(false)
    navigate('/level/0/stage/0?tutorial=true')
  }

  /**
   * A level is locked if it's "coming soon" OR it requires a prerequisite
   * that hasn't been satisfied yet.
   * Level 2 requires Level 1 avg score >= 80% across all stages.
   * Level 3 requires Level 2 avg score >= 80% across all stages.
   */
  const getLockState = (lv) => {
    if (!lv) return { locked: true, reason: '' }
    // Sandbox is always unlocked free practice, regardless of progress.
    if (lv.isSandbox) return { locked: false, reason: 'sandbox' }
    if (COMING_SOON.includes(lv.id)) return { locked: true, reason: 'Coming Soon' }

    if (lv.id === 0) return { locked: false, reason: '' }

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
    // Sandbox opens the workspace directly — it has no stage-selection screen.
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
      setTimeout(() => navigate('/'), 100)
    } catch (err) {
      toast.error('Failed to log out.')
    }
  }

  const prev = () => setSelected(s => Math.max(0, s - 1))
  const next = () => setSelected(s => Math.min(entries.length - 1, s + 1))

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
    <div className="min-h-screen min-h-[100dvh] bg-bg flex flex-col relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      {/* Header — shrinks to 52px on a landscape phone so the card + CTA fit. */}
      <header className="relative w-full h-[72px] [@media(max-height:480px)]:h-[52px] px-4 sm:px-8 flex items-center justify-between bg-bg-card/70 backdrop-blur-md border-b-2 border-border z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-300 shadow-xs hover:bg-slate-50 hover:shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Back to Home"
          >
            <span className="font-extrabold text-teal leading-none text-sm">←</span>
            <span>Home</span>
          </Link>
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src={logoFull} alt="Praxis" className="h-8 [@media(max-height:480px)]:h-6 object-contain" />
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            data-popup-anchor="tutorial"
            onClick={handleTutorialClick}
            className="h-9 [@media(max-height:480px)]:h-11 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal hover:text-white transition-all shadow-xs cursor-pointer"
            title="Interactive Tutorial"
          >
            <span>Tutorial</span>
          </button>
          <button data-popup-anchor="laws" className="w-9 h-9 [@media(max-height:480px)]:w-11 [@media(max-height:480px)]:h-11 rounded-full flex items-center justify-center text-lg text-text-2 bg-transparent hover:bg-border transition-all" title="Law Reference" onClick={() => setShowLawsDrawer(true)}>📖</button>
          <button 
            onClick={handleLogout}
            className="h-9 [@media(max-height:480px)]:h-11 px-3 rounded-lg flex items-center justify-center text-[13px] font-bold text-text-2 bg-bg hover:bg-border hover:text-text-1 transition-all sm:ml-1" 
            title="Sign Out"
          >
            Sign Out
          </button>
        </div>
      </header>

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
                    if (locked) return
                    if (isActive) {
                      handleStart()
                    } else {
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
                    {isSandbox ? '🧪' : isComingSoon ? '🔒' : locked ? '🔒' : done ? '✓' : lv.id}
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
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-bg rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, lockState.progress.avgScore)}%`,
                          background: lockState.progress.avgScore >= 80
                            ? '#22c55e'
                            : lockState.progress.avgScore >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      />
                    </div>
                    {/* Threshold marker label */}
                    <div className="text-[10px] text-text-3 text-center font-medium">
                      Need 80% avg across all Level {lockState.reqLevel || (lv.id - 1)} stages
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
                    type="button"
                    className="w-full mt-2 py-2 px-3 rounded-xl font-bold text-xs bg-accent text-white shadow-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStart()
                    }}
                  >
                    <span>{isSandbox ? 'Open Sandbox' : 'View Stages'}</span>
                    <span>→</span>
                  </button>
                )}

                {/* Tags */}
                {isComingSoon && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">Coming Soon</div>
                )}
                {isScoreGated && !isActive && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">🔒 80% avg required</div>
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
      <div className="flex justify-center gap-3 sm:gap-4 mb-5 [@media(max-height:480px)]:mb-1 [@media(max-height:359px)]:hidden">
        <span className="bg-bg-card border-[1.5px] border-border rounded-full px-3 sm:px-4 py-1.5 [@media(max-height:480px)]:py-0.5 text-sm [@media(max-height:480px)]:text-xs font-bold text-text-1 shadow-sm flex items-center gap-1.5">⭐ {progress.points || 0} Points</span>
        <span className="bg-bg-card border-[1.5px] border-border rounded-full px-3 sm:px-4 py-1.5 [@media(max-height:480px)]:py-0.5 text-sm [@media(max-height:480px)]:text-xs font-bold text-text-1 shadow-sm flex items-center gap-1.5">🔥 {progress.streak} streak</span>
      </div>

      {/* Start button — pinned into the fold on landscape phones. */}
      <div className="flex justify-center pb-16 [@media(max-height:480px)]:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] [@media(max-height:359px)]:pb-1">
        <button
          id="start-level-btn"
          className="bg-accent text-white text-base font-extrabold px-10 py-3.5 [@media(max-height:480px)]:px-8 [@media(max-height:480px)]:py-2.5 rounded-full shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 hover:scale-105 hover:shadow-xl active:scale-95 flex items-center gap-2 cursor-pointer"
          onClick={handleStart}
          disabled={!entries[selected] || getLockState(entries[selected]).locked}
        >
          <span>{entries[selected]?.isSandbox ? '🧪 ENTER SANDBOX' : '🚀 VIEW LEVEL STAGES'}</span>
          <span className="text-lg">→</span>
        </button>
      </div>

      {/* ── TUTORIAL REPLAY MODAL BEFORE ENTERING LEVEL 0 ── */}
      {showTutorialPrompt && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs transition-opacity"
          onClick={() => setShowTutorialPrompt(false)}
        >
          <div 
            data-popup-panel="centered"
            className="praxis-modal-panel relative bg-white rounded-3xl pt-9 pb-8 [@media(max-height:480px)]:pt-6 [@media(max-height:480px)]:pb-3 px-6 sm:px-10 max-w-[460px] w-full shadow-2xl border border-border/80 flex flex-col items-center text-center gap-5 [@media(max-height:480px)]:gap-2.5"
            style={{ transform: `translateY(${Math.round(popupPlacement ? popupPlacement.shift : 0)}px)` }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-slate-100 transition-all cursor-pointer"
              onClick={() => setShowTutorialPrompt(false)}
            >
              ✕
            </button>

            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3">
                Tutorial Replay
              </span>
              <h3 className="text-xl font-extrabold text-text-1 tracking-tight">
                Restart the Walkthrough?
              </h3>
            </div>

            <p className="text-[13.5px] text-text-2 leading-relaxed max-w-[380px]">
              You've already made progress in the tutorial. Would you like to reset your derivation and experience the full guided walkthrough again?
            </p>

            {/* Don't ask again checkbox */}
            <label className="flex items-center gap-2.5 px-3 py-1 rounded-lg hover:bg-bg cursor-pointer select-none -mt-1">
              <input
                type="checkbox"
                checked={dontAskTutorialAgain}
                onChange={e => setDontAskTutorialAgain(e.target.checked)}
                className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer accent-teal"
              />
              <span className="text-xs text-text-2 font-medium">Don't ask me again for this session</span>
            </label>

            {/* Actions */}
            <div className="praxis-modal-actions flex items-center gap-3 w-full mt-1">
              <button
                type="button"
                className="flex-1 min-h-11 py-3 px-4 text-xs font-bold text-text-2 bg-slate-100 hover:bg-slate-200 hover:text-text-1 rounded-xl transition-all cursor-pointer"
                onClick={() => setShowTutorialPrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 min-h-11 py-3 px-4 text-xs font-bold text-white bg-teal hover:bg-teal-600 active:scale-[0.98] rounded-xl transition-all shadow-sm cursor-pointer"
                onClick={handleRestartTutorial}
              >
                Restart Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LAWS DRAWER (SLIDING OVERLAY) ── */}
      <div className={`fixed inset-0 bg-accent/30 z-[100] transition-opacity duration-300 ${showLawsDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowLawsDrawer(false)} />
      <div
        data-testid="laws-drawer"
        className={`praxis-sheet-panel fixed right-0 max-w-[92vw] bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${showLawsDrawer ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          top: `${Math.round(popupPlacement ? popupPlacement.band.top : 0)}px`,
          maxHeight: `${Math.round(popupPlacement ? popupPlacement.band.maxHeight : 0)}px`,
          width: `${Math.round(popupPlacement ? popupPlacement.band.maxWidth : 340)}px`,
          opacity: popupPlacement ? 1 : 0,
        }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text-1">Law Reference</h2>
          <button data-testid="laws-close" className="praxis-touch-target shrink-0 rounded-full border-none bg-bg text-lg text-text-2 flex items-center justify-center hover:bg-border transition-all" onClick={() => setShowLawsDrawer(false)}>✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 praxis-safe-b">
          {laws && laws.map(law => (
            <div key={law.id} className="bg-bg border border-border rounded-lg p-3.5 text-left">
              <div className="text-[13px] font-bold text-text-1 mb-1">{law.name}</div>
              <div className="flex flex-col gap-1 my-2 bg-white border border-border rounded px-3 py-2 shadow-sm">
                {law.formulas && law.formulas.map((f, idx) => (
                  <div key={idx} className="font-mono text-xs font-semibold text-text-1">{f}</div>
                ))}
              </div>
              <div className="text-[12px] text-text-3 leading-relaxed mt-2">{law.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
