/**
 * @file Spotlight.jsx
 * @description The in-situ workspace spotlight: masked backdrop cutout, rigid
 * click blockers outside the hole(s) and the primary/secondary highlight rings.
 */
import { motion, AnimatePresence } from 'framer-motion'

export default function Spotlight({
  showWelcomeModal,
  currentStep,
  stageIdx,
  steps,
  isComplete,
  isPreLawHighlight,
  highlightRect,
  secondaryHighlightRect,
}) {
  return (
    <AnimatePresence>
      {(() => {
        const isDeadEndAbsorption = Boolean(stageIdx === 3 && currentStep?.id === 'challenge-solve' && steps.length > 0 && steps[steps.length - 1]?.law?.includes('Absorption') && !isComplete)
        const shouldHideOverlay = currentStep?.noOverlay && !isDeadEndAbsorption
        
        if (showWelcomeModal || !currentStep || !highlightRect || shouldHideOverlay) return null

        return (
          <motion.div
            key="spotlight-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 51 }}
          >
          {/* SVG Mask for soft curved backdrop cutout */}
          <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 51 }}>
            <defs>
              <mask id="tutorial-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <motion.rect
                  key={`cutout-pri-${currentStep?.id || 'target'}`}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    x: highlightRect.cutoutLeft ?? highlightRect.left,
                    y: highlightRect.cutoutTop ?? highlightRect.top,
                    width: highlightRect.cutoutWidth ?? highlightRect.width,
                    height: highlightRect.cutoutHeight ?? highlightRect.height,
                    rx: highlightRect.cutoutRx ?? 22,
                    ry: highlightRect.cutoutRx ?? 22,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  fill="black"
                />
                {secondaryHighlightRect && (
                  <motion.rect
                    key={`cutout-sec-${currentStep?.id || 'sec'}`}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      x: secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left,
                      y: secondaryHighlightRect.cutoutTop ?? secondaryHighlightRect.top,
                      width: secondaryHighlightRect.cutoutWidth ?? secondaryHighlightRect.width,
                      height: secondaryHighlightRect.cutoutHeight ?? secondaryHighlightRect.height,
                      rx: secondaryHighlightRect.cutoutRx ?? 22,
                      ry: secondaryHighlightRect.cutoutRx ?? 22,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(15, 23, 42, 0.40)"
              mask="url(#tutorial-spotlight-mask)"
            />
          </svg>

          {/* Rigid physical click blockers outside the cutout hole(s) */}
          {(() => {
            const bTop = secondaryHighlightRect 
              ? Math.min(highlightRect.cutoutTop ?? highlightRect.top, secondaryHighlightRect.cutoutTop ?? secondaryHighlightRect.top)
              : (highlightRect.cutoutTop ?? highlightRect.top)
            const bBottom = secondaryHighlightRect 
              ? Math.max((highlightRect.cutoutTop ?? highlightRect.top) + (highlightRect.cutoutHeight ?? highlightRect.height), (secondaryHighlightRect.cutoutTop ?? secondaryHighlightRect.top) + (secondaryHighlightRect.cutoutHeight ?? secondaryHighlightRect.height))
              : ((highlightRect.cutoutTop ?? highlightRect.top) + (highlightRect.cutoutHeight ?? highlightRect.height))
            const bLeft = secondaryHighlightRect 
              ? Math.min(highlightRect.cutoutLeft ?? highlightRect.left, secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left)
              : (highlightRect.cutoutLeft ?? highlightRect.left)
            const bRight = secondaryHighlightRect 
              ? Math.max((highlightRect.cutoutLeft ?? highlightRect.left) + (highlightRect.cutoutWidth ?? highlightRect.width), (secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left) + (secondaryHighlightRect.cutoutWidth ?? secondaryHighlightRect.width))
              : ((highlightRect.cutoutLeft ?? highlightRect.left) + (highlightRect.cutoutWidth ?? highlightRect.width))

            const r1 = secondaryHighlightRect && ((highlightRect.cutoutLeft ?? highlightRect.left) < (secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left) ? highlightRect : secondaryHighlightRect)
            const r2 = secondaryHighlightRect && (r1 === highlightRect ? secondaryHighlightRect : highlightRect)
            const r1Right = r1 ? (r1.cutoutLeft ?? r1.left) + (r1.cutoutWidth ?? r1.width) : 0
            const r2Left = r2 ? (r2.cutoutLeft ?? r2.left) : 0
            const hasMiddleGap = secondaryHighlightRect && (r2Left > r1Right)

            return (
              <>
                <div 
                  className="fixed top-0 left-0 right-0 pointer-events-auto cursor-default"
                  style={{ height: Math.max(0, bTop) }}
                  onClick={e => e.stopPropagation()}
                />
                <div 
                  className="fixed left-0 right-0 bottom-0 pointer-events-auto cursor-default"
                  style={{ top: Math.max(0, bBottom) }}
                  onClick={e => e.stopPropagation()}
                />
                <div 
                  className="fixed left-0 pointer-events-auto cursor-default"
                  style={{
                    top: Math.max(0, bTop),
                    width: Math.max(0, bLeft),
                    height: Math.max(0, bBottom - bTop),
                  }}
                  onClick={e => e.stopPropagation()}
                />
                <div 
                  className="fixed right-0 pointer-events-auto cursor-default"
                  style={{
                    top: Math.max(0, bTop),
                    left: Math.max(0, bRight),
                    height: Math.max(0, bBottom - bTop),
                  }}
                  onClick={e => e.stopPropagation()}
                />
                {hasMiddleGap && (
                  <div
                    className="fixed pointer-events-auto cursor-default"
                    style={{
                      top: Math.max(0, bTop),
                      left: r1Right,
                      width: r2Left - r1Right,
                      height: Math.max(0, bBottom - bTop),
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                )}
              </>
            )
          })()}

          {/* Highlight ring on target element */}
          {highlightRect && (
            <motion.div
              key={`ring-pri-${currentStep?.id || 'target'}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{
                opacity: 1,
                scale: 1,
                top: highlightRect.ringTop ?? highlightRect.top,
                left: highlightRect.ringLeft ?? highlightRect.left,
                width: highlightRect.ringWidth ?? highlightRect.width,
                height: highlightRect.ringHeight ?? highlightRect.height,
                borderRadius: `${highlightRect.ringRx ?? 10}px`,
              }}
              transition={{
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`fixed border-2 border-teal pointer-events-none shadow-[0_0_0_4px_rgba(46,196,182,0.25)] ${
                highlightRect.isScoreModal ? 'border-teal/50 rounded-2xl' : isPreLawHighlight ? 'rounded-xl' : 'rounded-xl animate-pulse'
              }`}
              style={{ zIndex: 52 }}
            />
          )}

          {/* Secondary highlight ring on drop target element ('z') */}
          {secondaryHighlightRect && !isPreLawHighlight && (
            <motion.div
              key={`ring-sec-${currentStep?.id || 'sec'}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{
                opacity: 1,
                scale: 1,
                top: secondaryHighlightRect.ringTop ?? secondaryHighlightRect.top,
                left: secondaryHighlightRect.ringLeft ?? secondaryHighlightRect.left,
                width: secondaryHighlightRect.ringWidth ?? secondaryHighlightRect.width,
                height: secondaryHighlightRect.ringHeight ?? secondaryHighlightRect.height,
                borderRadius: `${secondaryHighlightRect.ringRx ?? 10}px`,
              }}
              transition={{
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="fixed border-2 border-dashed border-teal/70 pointer-events-none shadow-[0_0_0_4px_rgba(46,196,182,0.15)] rounded-xl flex items-center justify-center"
              style={{ zIndex: 52 }}
            >
              {currentStep.actionType === 'swap' && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9.5px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider shadow-xs whitespace-nowrap">
                  Target
                </span>
              )}
            </motion.div>
          )}
        </motion.div>
        )
      })()}
    </AnimatePresence>
  )
}
