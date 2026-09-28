/**
 * SidePanel — the right column of the wide tiers: level (or sandbox) progress,
 * the points card with the Hint/Guide/Laws actions, and the quick stage picker
 * with its review reminder. The tiers that cannot afford a column fold these
 * blocks into the header and the bottom dock instead.
 *
 * Presentational: the panel data arrives as props, `lawsPanel` is the dock the
 * landscape tablet moves into this column.
 */
import { motion } from 'framer-motion'

import AssistanceControls from './AssistanceControls'
import { LawsReferenceButton } from './LawsReferenceSheet'

export default function SidePanel({
  showRightPanel, lawsInRightColumn, lawsPanel, isSandbox, isCustomSandbox, level,
  stageNum, completedSet, points, steps, optimalSteps, isComplete, showSuccess,
  dismissReviewReminder, onDismissReviewReminder, isTutorialActive, onSelectStage,
  onNavigateStages, assistanceInHeader, guideCost, onHint, onGuide, onOpenLaws,
  onRandomize, chromeText, chromeHeight,
}) {
  return (
    <>
      {/* ── RIGHT PANEL: Level Progress, Points, Assistance & Stages ──
           Hidden on the tiers that fold it into the header / bottom dock. */}
      {showRightPanel && (
      <aside className={lawsInRightColumn
        ? 'w-[300px] min-w-[260px] bg-white border-l border-border flex flex-col overflow-hidden'
        : 'w-[280px] min-w-[240px] bg-white border-l border-border flex flex-col overflow-hidden'}>
        {/* Top: Stage / Level Progress (sandbox shows problem stats instead) */}
        {isSandbox ? (
          <div data-tutorial="sandbox-stats" className="border-b border-border p-3.5 pt-4 bg-bg/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">SANDBOX</span>
              <span className="text-xs font-bold text-sky-700">{isCustomSandbox ? 'Custom' : 'Free Practice'}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-teal transition-all duration-300 rounded-full"
                style={{ width: `${optimalSteps > 0 ? Math.min(100, (steps.length / optimalSteps) * 100) : (isComplete ? 100 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-text-3 font-medium">
              <span>{isCustomSandbox ? 'Your expression' : 'Random problem'}</span>
              <span>
                <span className="font-bold text-text-2">{steps.length}</span> steps
                {optimalSteps > 0 && <span> · optimal {optimalSteps}</span>}
              </span>
            </div>
          </div>
        ) : (
        <div className="border-b border-border p-3.5 pt-4 bg-bg/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">LEVEL PROGRESS</span>
            <span className="text-xs font-bold text-teal">{completedSet.size} / {level?.puzzles.length ?? '?'} Completed</span>
          </div>
          <div className="h-1.5 bg-border rounded-full mb-1.5 overflow-hidden">
            <div
              className="h-full bg-teal transition-all duration-300 rounded-full"
              style={{ width: `${level && level.puzzles.length > 0 ? (completedSet.size / level.puzzles.length) * 100 : 0}%` }}
            />
          </div>
          <div className="text-[10.5px] text-text-3 font-medium">
            {level?.name || 'Level Stages'}
          </div>
        </div>
        )}

        {/* Middle: User Points & Assistance Controls (Replaced Target Box) */}
        <div data-tutorial="points-and-assistance" className="p-3.5 border-b border-border flex flex-col gap-2.5 bg-white">
          {/* User Points Card — sandbox play is unscored, so it shows a notice instead */}
          {isSandbox ? (
            <div data-tutorial="sandbox-notice" className="flex items-start gap-2.5 px-3.5 py-2.5 bg-sky-50/70 border border-sky-200 rounded-xl">
              <span className="text-lg leading-none">🧪</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-900/80">SANDBOX MODE</div>
                <div className="text-[11px] text-sky-900/90 leading-snug mt-0.5">
                  Free practice — no points, stars, or progress are recorded.
                </div>
              </div>
            </div>
          ) : (
          <div data-tutorial="points-card" className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/70 border border-amber/40 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80">TOTAL POINTS</div>
                <div className="text-base font-extrabold text-amber-600 leading-none mt-0.5">
                  {points ?? 0} <span className="text-[11px] font-semibold text-amber-700">pts</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-teal bg-teal/10 border border-teal/30 px-2 py-0.5 rounded-full">
                +10 to +15 on clear
              </span>
            </div>
          </div>
          )}

          {/* Sandbox random mode: ONE clear randomizer. The easy/medium/hard
              picker was removed at the user's request — the generator keeps its
              documented default preset, it is simply no longer a user setting. */}
          {isSandbox && !isCustomSandbox && (
            <button
              type="button"
              className="w-full py-2 rounded-lg border-[1.5px] border-teal bg-teal-light text-xs font-bold text-sky-700 hover:bg-teal hover:text-white hover:border-teal transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={onRandomize}
            >
              <span>🎲</span> New Random Problem
            </button>
          )}

          {/* Hint & Guide. Folded into the header when there is no side panel. */}
          {!assistanceInHeader && (
            <>
              <AssistanceControls compact={false} isComplete={isComplete} isSandbox={isSandbox} guideCost={guideCost} points={points} onHint={onHint} onGuide={onGuide} chromeText={chromeText} chromeHeight={chromeHeight} />
              <LawsReferenceButton compact={false} chromeText={chromeText} chromeHeight={chromeHeight} onOpen={onOpenLaws} />
            </>
          )}
        </div>

        {/* Level Puzzles List (Quick Stage Select) — replaced by the laws column
            on a landscape tablet, hidden entirely in sandbox mode. */}
        {lawsInRightColumn ? lawsPanel : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {isSandbox ? (
            <div className="text-[10.5px] text-text-3 leading-relaxed px-1 pt-1">
              <div className="font-bold tracking-[1px] uppercase text-text-3 mb-2">HOW IT WORKS</div>
              {isCustomSandbox ? (
                <>
                  <p className="mb-2">
                    This is the expression you typed. The engine always has a legal path back to its simplest
                    form, so every step you find is checked against the laws.
                  </p>
                  <p>
                    Press <span className="font-bold text-sky-700">✎ New expression</span> any time to go back and
                    type a different one — your current derivation is discarded.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    Every problem is generated from an inverse Boolean law, so the engine can always simplify it back down.
                  </p>
                  <p>
                    Press <span className="font-bold text-sky-700">🎲 New Random Problem</span> any time to swap in a
                    fresh expression — your current derivation is discarded.
                  </p>
                </>
              )}
            </div>
          ) : (
          <>
          {/* Review Mode Reminder Card */}
          {isComplete && !showSuccess && !dismissReviewReminder && level && stageNum + 1 < level.puzzles.length && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-emerald-50 border border-emerald-500/60 rounded-xl p-2.5 mb-1.5 flex flex-col gap-2 shadow-2xs"
            >
              <div className="flex items-start gap-2">
                <span className="relative flex h-2 w-2 mt-1 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <div className="text-[11.5px] leading-snug font-semibold text-emerald-950">
                  When you're ready, press the next stage.
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onDismissReviewReminder()}
                  className="px-3 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Okay
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-3">STAGES</span>
            <button
              type="button"
              onClick={onNavigateStages}
              className="text-xs font-bold text-teal hover:text-teal-600 hover:underline flex items-center gap-0.5 transition-colors cursor-pointer"
              title="View all stages overview"
            >
              All Stages →
            </button>
          </div>
          {level?.puzzles.map((p, idx) => {
            const isCurrent = idx === stageNum
            const isCompleted = completedSet.has(idx)
            const isAvailable = idx === 0 || completedSet.has(idx - 1) || isCompleted
            const isLocked = !isAvailable && !isCompleted
            const isNextAvailable = isComplete && !showSuccess && idx === stageNum + 1 && (idx === 0 || completedSet.has(idx - 1) || isCompleted)

            return (
              <button
                key={p.id || idx}
                disabled={isLocked || isTutorialActive}
                onClick={() => {
                  if (!isLocked && !isTutorialActive) onSelectStage(idx)
                }}
                className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all border ${
                  isTutorialActive
                    ? isCurrent
                      ? 'bg-teal/10 border-teal text-teal font-bold shadow-xs'
                      : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                    : isNextAvailable
                    ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-md animate-pulse cursor-pointer'
                    : isCurrent
                    ? 'bg-teal/10 border-teal text-teal font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-bg/50 border-transparent text-text-2 hover:bg-bg hover:border-border cursor-pointer'
                    : isAvailable
                    ? 'bg-transparent border-border text-text-1 hover:bg-bg cursor-pointer'
                    : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs w-4">{idx + 1}.</span>
                  <span className="font-mono text-xs">{p.initial || `Stage ${idx + 1}`}</span>
                </div>
                {isNextAvailable && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Next →</span>
                )}
                {!isNextAvailable && isCompleted && <span className="text-teal text-xs font-bold">✓</span>}
                {!isNextAvailable && isLocked && <span className="text-xs text-text-3 opacity-60">🔒</span>}
              </button>
            )
          })}
          </>
          )}
        </div>
        )}
      </aside>
      )}
    </>
  )
}
