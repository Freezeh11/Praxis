/**
 * LawsReferenceSheet — the Boolean-laws quick reference of the puzzle
 * workspace. Narrow or short viewports get a full-width bottom sheet, wide +
 * tall ones a right-hand drawer. The two variants share the cards, the header
 * and the measured band, but not their geometry: the sheet spans the bottom
 * edge (`inset-x-0`, top-rounded, slides up), the drawer hangs off the right
 * edge at a bounded width (left-rounded, full height of the band, slides in
 * from the right). The cards are the shared LawCard.
 *
 * `LawsReferenceButton` is the anchor the panel hangs from: the compact tiers
 * put it in the header rail, the wide ones in the side panel.
 */
import { AnimatePresence, motion } from 'framer-motion'

import usePanelSound from '../../hooks/usePanelSound'
import LawCard from '../laws/LawCard'

export function LawsReferenceButton({ compact, chromeText, chromeHeight, onOpen }) {
  return (
    <button
      data-tutorial="laws-reference-button"
      data-testid="laws-sheet-anchor"
      className={compact
        ? `shrink-0 px-3 py-2 bg-bg border border-border rounded-lg font-semibold text-text-2 hover:bg-border/60 transition-all flex items-center justify-center gap-1.5 shadow-xs ${chromeText} ${chromeHeight}`
        : 'w-full py-2 px-3 bg-bg border border-border rounded-lg text-xs font-semibold text-text-2 hover:bg-border/60 transition-all flex items-center justify-between shadow-xs'}
      onClick={() => onOpen()}
    >
      {compact
        ? <><span aria-hidden="true">📖</span> Laws</>
        : <><span>📖 Laws Quick Reference</span><span className="text-text-3">→</span></>}
    </button>
  )
}

export default function LawsReferenceSheet({ show, lawsSheet, laws, nodeRef, band, ready, onClose }) {
  // The sheet and the drawer are the same panel to the ear: one cue per
  // open/close, however it was dismissed (scrim, ✕, tier change).
  usePanelSound(show)

  const top = Math.round(band ? band.top : 0)
  const bandHeight = Math.round(band ? band.maxHeight : 0)
  // The sheet is as tall as its content up to the band; the drawer fills the
  // band so it reads as a drawer rather than a floating card.
  const geometry = lawsSheet
    ? { top: `${top}px`, maxHeight: `${bandHeight}px` }
    : { top: `${top}px`, height: `${bandHeight}px` }

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/25"
            onClick={() => onClose()}
          />
          <motion.div
            data-testid={lawsSheet ? 'laws-sheet' : 'laws-drawer'}
            ref={nodeRef}
            initial={lawsSheet ? { y: '18%' } : { x: '100%' }}
            animate={lawsSheet ? { y: 0 } : { x: 0 }}
            exit={lawsSheet ? { y: '18%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            style={{
              ...geometry,
              opacity: ready ? 1 : 0,
              pointerEvents: ready ? 'auto' : 'none',
            }}
            className={lawsSheet
              ? 'praxis-sheet-panel fixed inset-x-0 z-50 bg-white border-t border-border shadow-2xl flex flex-col will-change-transform'
              : 'praxis-drawer-panel fixed right-0 z-50 w-[25rem] max-w-[92vw] bg-white border-l border-border shadow-2xl flex flex-col will-change-transform'}
          >
            <div className={`flex items-center justify-between bg-bg shrink-0 ${lawsSheet ? 'px-4 py-2' : 'p-4'}`}>
              <div className="font-bold text-sm text-text-1 flex items-center gap-2">
                <span>📖</span> Boolean Laws Reference
              </div>
              <button
                type="button"
                data-testid="laws-close"
                className="praxis-touch-target rounded-md hover:bg-border text-text-3 hover:text-text-1 flex items-center justify-center font-bold text-sm transition-colors"
                onClick={() => onClose()}
                title="Close the laws reference"
              >
                ✕
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 ${lawsSheet ? 'praxis-safe-b' : ''}`}>
              {laws && laws.map(law => (
                <LawCard key={law.id} law={law} />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
