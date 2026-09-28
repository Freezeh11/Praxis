/**
 * DerivationCanvas — the expression workspace: the animation overlay, the
 * status banner, the zoom wrapper with the custom-sandbox label, the derivation
 * chain (ExpressionDisplay for the active line, ExprText for history) and the
 * stepper rail that opens a step's explanation.
 *
 * Presentational: the whole game state arrives as props.
 */
import { motion } from 'framer-motion'

import AnimationOverlay from '../AnimationOverlay'
import ExpressionDisplay from '../ExpressionDisplay'
import ExprText from '../ExprText'

export default function DerivationCanvas({
  expr, sel, steps, status, statusMsg, isAnimating, animationData,
  inspectedStepIdx, setInspectedStepIdx, activeGuidePaths, onClickLit, onClickNot,
  onClickTerm, swapTerms, touchTargets, isPhoneLandscape, isSandbox, sandboxNonce,
  isCustomSandbox, customPuzzle, zoom,
}) {
  return (
    <div className={`flex-1 flex flex-col bg-white bg-[linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:28px_28px] relative ${isPhoneLandscape ? 'min-h-0 justify-start items-stretch' : 'min-h-[400px] justify-start items-stretch'} ${touchTargets ? 'overflow-auto [-webkit-overflow-scrolling:touch]' : 'overflow-hidden'} ${isAnimating ? 'pointer-events-none opacity-90' : ''}`}>
      {isAnimating && <AnimationOverlay data={animationData} />}

      {/* Status banner — placed in flow at top so it NEVER overlays equations */}
      {status !== 'select' && (
        <div className="w-full flex justify-center items-center px-4 pt-3 pb-1 z-20 shrink-0 select-none">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-[0.1px] shadow-sm border-[1.5px] max-w-[95%] sm:max-w-xl text-center transition-all duration-200
                ${status === 'error' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                ${status === 'laws' ? 'bg-teal-light text-sky-700 border-sky-300' : ''}
                ${status === 'success' ? 'bg-green-light text-green-800 border-green-300' : ''}
              `}>
            {status === 'success' && <span className="text-xs font-bold shrink-0">✓</span>}
            {status === 'error'   && <span className="text-xs font-bold shrink-0">✕</span>}
            {status === 'laws'    && <span className="text-xs font-bold shrink-0">→</span>}
            <span className="leading-snug break-words">{statusMsg}</span>
          </div>
        </div>
      )}

      <div className={isPhoneLandscape
        ? 'relative w-full flex-1 flex flex-col items-start justify-start py-1'
        : 'relative w-full flex-1 flex flex-col justify-center items-center py-2'}>

        {/* Zoom wrapper — scales the entire expression block.
            In sandbox mode the nonce forces a clean remount on randomize so
            no stale selection/animation state can leak into a new problem. */}
        <div data-tutorial="canvas" key={isSandbox ? sandboxNonce : undefined} style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.18s ease' }}>
          {/* Custom sandbox: keep the typed expression in view so the
              derivation can always be compared with what was asked for. */}
          {isCustomSandbox && (
            <div
              data-testid="custom-expression-label"
              className={`mb-2 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-1.5 ${isPhoneLandscape ? 'text-[14px]' : 'text-[12px]'}`}
            >
              <span className="font-bold uppercase tracking-wider text-sky-900/70">Your expression</span>
              <span className={`font-mono font-semibold text-sky-900 whitespace-nowrap ${isPhoneLandscape ? 'text-[16px]' : 'text-[15px]'}`}>
                {customPuzzle.expr}
              </span>
            </div>
          )}
          {/* Derivation chain — clean FIFO top-to-bottom queue */}
        {expr && (() => {
          const totalSteps = steps.length

          // Build unified list of derivation lines
          const lines = []
          if (totalSteps === 0) {
            lines.push({
              key: 'active-0',
              isFirst: true,
              isActive: true,
              text: null,
              stepIdx: null,
              law: null,
            })
          } else {
            // Line 0: Starting problem
            lines.push({
              key: 'past-0',
              isFirst: true,
              isActive: false,
              text: steps[0].from,
              stepIdx: 0,
              law: steps[0].law,
            })
            // Intermediate lines
            for (let i = 1; i < totalSteps; i++) {
              lines.push({
                key: `past-${i}`,
                isFirst: false,
                isActive: false,
                text: steps[i - 1].to,
                stepIdx: i,
                law: steps[i].law,
              })
            }
            // Active bottom line
            lines.push({
              key: `active-${totalSteps}`,
              isFirst: false,
              isActive: true,
              text: null,
              stepIdx: null,
              law: null,
            })
          }

          return (
            <motion.div
              layout
              className="flex flex-col gap-3 font-mono text-[22px] font-medium items-start select-none"
              onClick={() => setInspectedStepIdx(null)}
            >
              {lines.map((line, idx) => {
                const isFromInspected = line.stepIdx !== null && inspectedStepIdx === line.stepIdx
                const isToInspected = idx > 0 && inspectedStepIdx === idx - 1
                const isLineHighlighted = isFromInspected || isToInspected
                return (
                  <motion.div
                    layout
                    key={line.key}
                    initial={{ opacity: 0, y: line.isActive && idx > 0 ? 6 : 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                    className="relative flex items-center min-h-[44px] gap-2.5"
                  >
                    {/* Stepper Left Rail: Dot + Symmetrical Connector Line (Independent Column with z-30) */}
                    <div className="relative flex items-center justify-center w-6 self-stretch shrink-0 select-none z-30">
                      {/* Downward connector line centered exactly between node i and node i+1 */}
                      {line.stepIdx !== null && (
                        <button
                          type="button"
                          data-inspect-trigger="true"
                          data-inspect-step={line.stepIdx}
                          onClick={(e) => {
                            e.stopPropagation()
                            setInspectedStepIdx(prev => (prev === line.stepIdx ? null : line.stepIdx))
                          }}
                          className="group absolute top-[calc(50%+8px)] left-1/2 -translate-x-1/2 w-8 h-[calc(100%-4px)] flex items-center justify-center cursor-pointer p-0 bg-transparent border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 active:outline-none z-30"
                          style={{ outline: 'none' }}
                          title={`Click to inspect ${line.law}`}
                        >
                          {/* Symmetrical vertical line */}
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              inspectedStepIdx === line.stepIdx
                                ? 'bg-teal w-[3.5px] shadow-[0_0_8px_rgba(13,148,136,0.4)]'
                                : 'bg-slate-300 w-[2px] group-hover:bg-teal group-hover:w-[3px]'
                            }`}
                          />
                        </button>
                      )}

                      {/* Node Dot */}
                      {isLineHighlighted ? (
                        <div className="relative z-30 w-3 h-3 rounded-full bg-teal ring-4 ring-teal/20 shadow-xs transition-all duration-200" />
                      ) : line.isActive ? (
                        <div className="relative z-30 flex items-center justify-center w-4 h-4 rounded-full border-2 border-teal bg-white shadow-xs transition-all">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                        </div>
                      ) : (
                        <div className="relative z-30 w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-200" />
                      )}

                      {/* The law-explanation card and the step-inspection tip
                          hang off this line in the collision-aware popup layer. */}
                    </div>

                    {/* Formula Display with Highlight Box wrapping ONLY the equation */}
                    <div
                      data-tutorial={line.isActive ? "active-equation" : undefined}
                      data-inspect-anchor={isFromInspected ? "true" : undefined}
                      onClick={!line.isActive && line.stepIdx !== null ? (e) => {
                        e.stopPropagation()
                        setInspectedStepIdx(prev => (prev === line.stepIdx ? null : line.stepIdx))
                      } : undefined}
                      className={`relative flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                        !line.isActive ? 'cursor-pointer hover:bg-slate-50/70' : ''
                      } ${
                        isLineHighlighted
                          ? 'border-teal/30 bg-teal-50/50 shadow-xs ring-1 ring-teal/20'
                          : 'border-transparent'
                      }`}
                    >
                      <span
                        className={`font-mono text-[22px] whitespace-pre shrink-0 select-none mr-1 transition-colors duration-300 ${
                          isLineHighlighted ? 'text-teal font-semibold' : 'text-text-2 font-medium'
                        }`}
                      >
                        {line.isFirst ? 'F =' : '\u00a0\u00a0='}
                      </span>
                      {line.isActive ? (
                        <ExpressionDisplay
                          expr={expr}
                          sel={sel}
                          onClickLit={onClickLit}
                          onClickNot={onClickNot}
                          onClickTerm={onClickTerm}
                          onSwapTerms={swapTerms}
                          activeGuidePaths={activeGuidePaths}
                          animationPaths={isAnimating ? animationData?.paths : []}
                          animationLaw={isAnimating ? animationData?.lawId : null}
                          touchTargets={touchTargets}
                        />
                      ) : (
                        <ExprText
                          text={line.text}
                          className={isLineHighlighted ? 'text-slate-900 font-semibold' : 'text-text-1'}
                        />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )
        })()}
        </div>{/* end zoom wrapper */}

        {/* The hint bubble is no longer an inline flex sibling: in flow it
            pushed the canvas content and was clipped by the scrollable
            canvas on a 320px-tall phone. It renders in the collision layer
            below instead. */}
      </div>
    </div>
  )
}
