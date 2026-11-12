import Icon from '../ui/Icon'
/**
 * @file WelcomeModal.jsx
 * @description The two-slide cinematic welcome modal: slide content, slide dots
 * and the Skip/Back/Continue action row. Copy comes from WELCOME_SLIDES.
 */
import { m, AnimatePresence } from 'framer-motion'
import useDialogA11y from '../../hooks/useDialogA11y'
import { WELCOME_SLIDES } from '../../content/tutorialContent.js'
import logoFull from '../../assets/logo-full.png'

export default function WelcomeModal({
  showWelcomeModal,
  currentSlideIdx,
  setCurrentSlideIdx,
  setShowWelcomeModal,
  onResetStage,
}) {
  const activeSlide = WELCOME_SLIDES[currentSlideIdx] || WELCOME_SLIDES[0]

  // The welcome overlay is a modal dialog: focus enters the primary action, Tab
  // is trapped, Escape skips the tour (same path as the Skip button), and focus
  // returns to the trigger when it closes.
  const closeWelcome = () => {
    setShowWelcomeModal(false)
    onResetStage?.()
  }
  const panelRef = useDialogA11y(showWelcomeModal, closeWelcome)

  return (
    <AnimatePresence>
      {showWelcomeModal && (
        <m.div
          key="welcome-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 pointer-events-auto will-change-[opacity]"
        >
          <m.div
            ref={panelRef}
            layout
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            tabIndex={-1}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            className="praxis-modal-panel bg-bg-card rounded-3xl pt-10 pb-9 [@media(max-height:480px)]:pt-14 [@media(max-height:480px)]:pb-3 px-5 sm:px-12 max-w-[500px] w-full shadow-2xl border border-border/80 flex flex-col relative overflow-hidden will-change-transform"
          >
            {/* The dialog needs a name even on the logo slide, so the accessible
                title is rendered here and the visible slide headings stay visual. */}
            <h2 id="welcome-title" className="sr-only">
              {currentSlideIdx === 0 ? 'Welcome to Praxis' : activeSlide.title}
            </h2>

            {/* Top Header: Floating Minimalist Skip Button */}
            <button
              type="button"
              onClick={closeWelcome}
              className="absolute top-6 right-6 [@media(max-height:480px)]:top-2 [@media(max-height:480px)]:right-2 min-h-11 px-2.5 py-1 inline-flex items-center rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              Skip <Icon name="close" />
            </button>

            {/* Dynamic Slide Content */}
            <div className="min-h-[250px] [@media(max-height:480px)]:min-h-0 flex flex-col justify-center items-center mt-3 [@media(max-height:480px)]:mt-0">
              <AnimatePresence mode="wait">
                <m.div
                  key={currentSlideIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex flex-col items-center text-center w-full"
                >
                  {currentSlideIdx === 0 ? (
                    <>
                      {/* Slide 1: Welcome to Praxis */}
                      <div className="flex flex-col items-center mb-7 [@media(max-height:480px)]:mb-3">
                        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3 mb-3">
                          Welcome to
                        </span>
                        <img src={logoFull} alt="Praxis" className="h-8 object-contain select-none" />
                      </div>

                      <p className="text-[13.5px] text-text-2 leading-[1.75] max-w-[400px] mb-6 [@media(max-height:480px)]:mb-3">
                        {activeSlide.body}
                      </p>

                      <p className="text-[14px] font-semibold text-text-1">
                        {activeSlide.footer}
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Slide 2: Interactive Fundamentals */}
                      <div className="flex flex-col items-center mb-7 [@media(max-height:480px)]:mb-3">
                        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3 mb-3">
                          Core Mechanics
                        </span>
                        <h2 aria-hidden="true" className="text-[22px] font-extrabold text-text-1 tracking-tight">
                          {activeSlide.title}
                        </h2>
                      </div>

                      <p className="text-[13.5px] text-text-2 leading-[1.75] max-w-[400px] mb-6 [@media(max-height:480px)]:mb-3">
                        {activeSlide.body}
                      </p>

                      <p className="text-[14px] font-semibold text-text-1">
                        {activeSlide.footer}
                      </p>
                    </>
                  )}
                </m.div>
              </AnimatePresence>
            </div>

            {/* Bottom Action Footer */}
            <div className="praxis-modal-actions flex items-center justify-between mt-10 [@media(max-height:480px)]:mt-3 w-full h-11 shrink-0">
              {/* Left slot: Back button */}
              <div className="w-[110px] flex justify-start">
                {currentSlideIdx > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentSlideIdx(prev => Math.max(0, prev - 1))}
                    className="h-11 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                  >
                    ← Back
                  </button>
                ) : (
                  <div />
                )}
              </div>

              {/* Center slot: Slide progress indicator */}
              <div className="flex items-center gap-2 justify-center">
                {WELCOME_SLIDES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentSlideIdx ? 'w-6 bg-indigo-600 dark:bg-cyan-400' : 'w-2 bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Right slot: Action button */}
              <div className="w-[110px] flex justify-end">
                {currentSlideIdx < WELCOME_SLIDES.length - 1 ? (
                  <button
                    type="button"
                    data-autofocus
                    onClick={() => setCurrentSlideIdx(prev => prev + 1)}
                    className="h-11 px-4 rounded-xl text-xs font-bold bg-accent text-on-accent hover:bg-accent-hover transition-colors shrink-0 whitespace-nowrap shadow-xs flex items-center justify-center"
                  >
                    {activeSlide.buttonText}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-autofocus
                    onClick={closeWelcome}
                    className="h-11 px-4 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 transition-colors flex items-center justify-center shrink-0 whitespace-nowrap shadow-sm"
                  >
                    {activeSlide.buttonText}
                  </button>
                )}
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
