import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AppHeader from '../components/layout/AppHeader.jsx'
import BackNav from '../components/layout/BackNav.jsx'
import { NameForm, PasswordForm } from '../components/profile/AccountForms.jsx'
import SignOutConfirmModal from '../components/ui/SignOutConfirmModal.jsx'
import SoundToggle from '../components/ui/SoundToggle.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import { LEVELS } from '../content/gameContent.js'
import { UNLOCK_AVERAGE_SCORE } from '../config/gameRules.js'
import useSoundEnabled from '../hooks/useSoundEnabled.js'
import { signOut } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'
import { useProgress } from '../state/useProgress.js'
import { summarizeProfile } from '../state/profileSummary.js'

const cardClass = 'rounded-2xl border border-border bg-bg-card p-5 sm:p-6 shadow-sm'
const sectionTitle = 'text-lg font-bold text-text-1'
const secondaryText = 'text-sm text-text-3 leading-relaxed'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { progress, getLevelProgress, hasCompletedTutorial } = useProgress()
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()
  const [showSignOut, setShowSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()
  const user = session?.user
  if (!user) return null

  const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Learner'
  const summary = summarizeProfile(progress, LEVELS)
  const joined = user.created_at ? new Date(user.created_at) : null
  const joinedLabel = joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
  const emailAccount = user.identities?.some(identity => identity.provider === 'email') || user.app_metadata?.provider === 'email'

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) throw error
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Could not sign out. Please try again.')
    } finally {
      setSigningOut(false)
      setShowSignOut(false)
    }
  }


  return (
    <div className="min-h-screen bg-bg text-text-1">
      <AppHeader left={<BackNav to="/" label="Home" title="Back to home" />} right={<Link to="/levels" className="text-sm font-bold text-accent min-h-11 inline-flex items-center"><span className="sm:hidden">Learn →</span><span className="hidden sm:inline">Continue learning →</span></Link>} />
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-7">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-bold text-teal mb-2">Your learning space</p>
          <h1 className="text-3xl font-extrabold tracking-tight">My profile</h1>
          <p className={`${secondaryText} mt-2`}>Track your progress and make Praxis yours.</p>
        </div>

        <section aria-label="Profile overview" className={`${cardClass} flex flex-wrap items-center gap-5`}>
          <div className="min-w-0 basis-40 flex-1">
            <h2 className="text-2xl font-bold break-words">{name}</h2>
            <p className={`${secondaryText} break-all`}>{user.email || 'Connected account'}</p>
            {joinedLabel && <p className="text-xs text-text-3 mt-2">Learning with Praxis since {joinedLabel}</p>}
          </div>
          <span tabIndex={0} aria-describedby="progress-help" className={`group relative cursor-help rounded-full px-3 py-1.5 text-xs font-bold ${hasCompletedTutorial ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-accent border border-blue-200'}`}>{hasCompletedTutorial ? 'Tutorial completed' : 'Getting started'}<span id="progress-help" role="tooltip" className="absolute right-0 top-full mt-2 z-30 w-64 rounded-xl border border-border bg-bg-card p-3 text-sm font-normal text-text-1 shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">Finish all four tutorial stages to unlock Level 1. Then complete every stage in each level with at least {UNLOCK_AVERAGE_SCORE}% average to open the next level. Replay stages to improve your best scores.</span></span>
        </section>

        <section aria-label="Learning statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            ['Points available', progress.points ?? 0, 'Use points for guided assistance'],
            ['Stages completed', `${summary.completed} / ${summary.total}`, 'Across tutorial and all levels'],
            ['Average best score', summary.average === null ? '—' : `${summary.average}%`, 'Across stages with a recorded score'],
            ['Stars earned', summary.stars, 'Keep improving your stage scores'],
          ].map(([label, value, description]) => <div key={label} className={cardClass}><p className="text-xs font-semibold text-text-3">{label}</p><p className="text-3xl font-extrabold tracking-tight mt-2 mb-2">{value}</p><p className="text-xs text-text-3 leading-relaxed">{description}</p></div>)}
        </section>

        <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <section className={cardClass} aria-labelledby="profile-levels-title">
              <h2 id="profile-levels-title" className={sectionTitle}>Your learning journey</h2>
              <p className={`${secondaryText} mt-1 mb-5`}>Every stage is a step toward stronger Boolean reasoning.</p>
              <div className="space-y-5">
                {summary.levelProgress.map(level => {
                  const previousLevel = LEVELS.find(previous => previous.id === level.id - 1)
                  const locked = level.id === 1 ? !hasCompletedTutorial : level.id > 1 && (!hasCompletedTutorial || !getLevelProgress(previousLevel.id, previousLevel.puzzles.length).unlocked)
                  const mastery = getLevelProgress(level.id, level.total)
                  const missingStages = level.puzzles.map((_, index) => index).filter(index => !Number.isFinite(progress.stageScores?.[`${level.id}:${index}`]))
                  const completion = level.total ? Math.round(level.completed / level.total * 100) : 0
                  return <div key={level.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2"><span className="font-semibold text-sm">{level.name}</span><span className="text-xs text-text-3">{level.completed} / {level.total} stages</span></div>
                    <div role="progressbar" aria-label={`${level.name} completion`} aria-valuemin={0} aria-valuemax={level.total} aria-valuenow={level.completed} className="h-2 rounded-full bg-bg overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completion}%` }} /></div>
                    <div className="mt-2 flex justify-between gap-3 text-xs">
                      <span className="text-text-3">{locked ? level.id === 1 || !hasCompletedTutorial ? 'Complete the tutorial to unlock' : `Complete Level ${level.id - 1} with ${UNLOCK_AVERAGE_SCORE}% average to unlock` : completion === 100 ? 'All stages completed' : `${completion}% complete`}</span>
                      {!locked && <Link className="text-accent font-bold shrink-0" to={`/level/${level.id}/stages`}>{level.completed ? 'View stages' : 'Get started'} →</Link>}
                    </div>
                    {level.id > 0 && <div className="mt-2 text-xs text-text-2 space-y-1">
                      <p>Level average: {mastery.avgScore}% / {UNLOCK_AVERAGE_SCORE}% required{mastery.avgScore < UNLOCK_AVERAGE_SCORE ? ` · ${UNLOCK_AVERAGE_SCORE - mastery.avgScore} percentage points short` : ' · Score requirement met'}. Unscored stages count as zero.</p>
                      <p>{missingStages.length ? `Stages still needing a score: ${missingStages.map(index => index + 1).join(', ')}.` : 'Every stage has a score.'} {mastery.unlocked ? level.id === LEVELS.at(-1).id ? 'Final level mastered.' : 'Ready for the next level.' : 'Complete all stages and improve low scores to progress.'}</p>
                    </div>}
                  </div>
                })}
              </div>
            </section>

          </div>

          <div className="space-y-6 min-w-0">
            <section className={cardClass} aria-labelledby="profile-account-title">
              <h2 id="profile-account-title" className={sectionTitle}>Account details</h2>
              <p className={`${secondaryText} mt-1 mb-5`}>Choose how your name appears in Praxis.</p>
              <NameForm key={user.id} user={user} />
              <div className="border-t border-border mt-5 pt-4"><p className="text-xs font-semibold text-text-3 mb-1">Email address</p><p className="text-sm break-all">{user.email || 'No email provided'}</p>{user.email && <p className="text-xs text-text-3 mt-1">{user.email_confirmed_at ? 'Email verified' : 'Email not yet verified'}</p>}</div>
            </section>

            <section className={cardClass} aria-labelledby="profile-preferences-title">
              <h2 id="profile-preferences-title" className={sectionTitle}>Preferences</h2>
              <div className="flex items-center justify-between gap-4 mt-4"><div><p className="text-sm font-semibold">Appearance</p><p className="text-xs text-text-3 mt-1">Saved on this device</p></div><ThemeToggle /></div>
              <div className="flex items-center justify-between gap-4 mt-4"><div><p className="text-sm font-semibold">Sound effects</p><p className="text-xs text-text-3 mt-1">{soundEnabled ? 'On' : 'Off'} · Saved on this device</p></div><SoundToggle enabled={soundEnabled} onToggle={toggleSound} /></div>
            </section>

            {emailAccount && <section className={cardClass} aria-labelledby="profile-password-title"><h2 id="profile-password-title" className={sectionTitle}>Password</h2><p className={`${secondaryText} mt-1 mb-5`}>Update the password you use to sign in.</p><PasswordForm key={user.id} /></section>}

            <section className={cardClass} aria-labelledby="profile-data-title">
              <h2 id="profile-data-title" className={sectionTitle}>Session</h2>
              <div className="border-t border-border mt-5 pt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-3">Signed in on this device</p><button type="button" disabled={signingOut} onClick={() => setShowSignOut(true)} className="text-sm font-bold text-red-600 min-h-11 px-2 disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
            </section>
          </div>
        </div>
      </main>
      <SignOutConfirmModal show={showSignOut} onClose={() => { if (!signingOut) setShowSignOut(false) }} onConfirm={handleSignOut} />
    </div>
  )
}
