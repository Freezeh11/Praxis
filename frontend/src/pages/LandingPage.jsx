import AppHeader from '../components/layout/AppHeader.jsx'
import { Link } from 'react-router-dom'
import SurveyButton from '../components/layout/SurveyButton'
import SoundToggle from '../components/ui/SoundToggle'
import { useSession } from '../state/useSession.js'
import useSoundEnabled from '../hooks/useSoundEnabled.js'
import ProfileLink from '../components/layout/ProfileLink.jsx'

/** Entrance stagger, in milliseconds. CSS owns the animation — see .praxis-rise. */
const RISE = { badge: '80ms', headline: '200ms', sub: '340ms', cta: '480ms' }

export default function LandingPage() {
  const { data: session } = useSession()
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()

  return (
    <div className="min-h-screen min-h-[100dvh] bg-transparent flex flex-col relative overflow-hidden">
      {/* Light canvas wash: a faint indigo veil behind the hero so the page
          opens on tinted air instead of flat white. Decorative only, and the
          root stays transparent — text always computes its contrast against the
          solid body canvas, never against this gradient. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[68vh] bg-gradient-to-b from-indigo-100/60 via-sky-50/40 to-transparent dark:from-indigo-500/10 dark:via-cyan-500/5" />

      {/* Header */}
      <AppHeader
        right={(
          <>
            <SoundToggle enabled={soundEnabled} onToggle={toggleSound} compact />
            <SurveyButton compact />
            {session ? <ProfileLink /> : null}
          </>
        )}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center praxis-page-x py-6 z-10 -mt-10 [@media(max-height:480px)]:mt-0">
        <div className="max-w-3xl w-full flex flex-col items-center text-center">

          {/* Badge */}
          <div className="praxis-rise mb-4 sm:mb-6" style={{ animationDelay: RISE.badge }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700 shadow-chip ring-1 ring-indigo-500/5 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:shadow-none dark:ring-0">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-[0_0_0_3px_rgba(79,70,229,0.12)]" />
              Interactive Learning
            </span>
          </div>

          {/* Headline. The accent phrase keeps a solid indigo-600 foreground —
              contrast is measured against a real colour, never against a
              clipped gradient — and the gradient lives in the rule beneath it. */}
          <h1 className="praxis-rise text-[32px] sm:text-5xl md:text-6xl font-extrabold text-text-1 tracking-tight leading-[1.1] mb-4 sm:mb-6" style={{ animationDelay: RISE.headline }}>
            Master Boolean Algebra<br className="hidden md:block" />{' '}
            <span className="relative inline-block text-indigo-600 dark:text-cyan-300">
              Without the Headache.
              <span aria-hidden="true" className="absolute inset-x-1 -bottom-1 h-[5px] rounded-full bg-gradient-to-r from-indigo-500/70 via-indigo-400/50 to-cyan-400/60 sm:h-[7px]" />
            </span>
          </h1>

          {/* Subheadline */}
          <p className="praxis-rise text-base sm:text-lg md:text-xl text-text-2 font-medium max-w-xl mb-6 sm:mb-8 leading-relaxed" style={{ animationDelay: RISE.sub }}>
            Practice Boolean algebra, apply laws, and prove equivalences with a clear interactive approach.
          </p>

          {/* CTAs */}
          <div className="praxis-rise flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full justify-center" style={{ animationDelay: RISE.cta }}>
            {session ? (
              <Link
                to="/levels"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-indigo-600/25 ring-1 ring-inset ring-white/20 transition-[transform,filter,box-shadow] duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-xl hover:shadow-indigo-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:w-auto dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400/60 dark:focus-visible:ring-offset-[#0B0F19]"
              >
                Go to Level Selection <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-indigo-600/25 ring-1 ring-inset ring-white/20 transition-[transform,filter,box-shadow] duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-xl hover:shadow-indigo-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:w-auto dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400/60 dark:focus-visible:ring-offset-[#0B0F19]"
                >
                  Start Learning Free <span aria-hidden="true">→</span>
                </Link>
                <Link
                  to="/login"
                  className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white/85 px-8 py-3.5 text-[15px] font-bold text-slate-700 shadow-card transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:text-slate-900 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 sm:w-auto dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/80 dark:focus-visible:ring-cyan-400/60"
                >
                  I already have an account
                </Link>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Decorative Blur Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-40 -z-10 h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.18),transparent_62%)] dark:bg-[radial-gradient(circle,rgba(99,102,241,0.16),transparent_62%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-32 -z-10 h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.14),transparent_62%)] dark:bg-[radial-gradient(circle,rgba(6,182,212,0.12),transparent_62%)]" />
    </div>
  )
}
