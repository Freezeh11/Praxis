import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AppHeader from '../components/layout/AppHeader.jsx'
import BackNav from '../components/layout/BackNav.jsx'
import { NameForm, PasswordForm } from '../components/profile/AccountForms.jsx'
import SignOutConfirmModal from '../components/ui/SignOutConfirmModal.jsx'
import SoundToggle from '../components/ui/SoundToggle.jsx'
import { LEVELS } from '../content/gameContent.js'
import { UNLOCK_AVERAGE_SCORE } from '../config/gameRules.js'
import useSoundEnabled from '../hooks/useSoundEnabled.js'
import { signOut } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'
import { useProgress } from '../state/useProgress.js'
import { summarizeProfile } from '../state/profileSummary.js'

const cardClass = 'rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm'
const sectionTitle = 'text-lg font-bold text-text-1'
const secondaryText = 'text-sm text-text-3 leading-relaxed'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { progress, getLevelProgress, hasCompletedTutorial } = useProgress()
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()
  const [showSignOut, setShowSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showAllSolutions, setShowAllSolutions] = useState(false)
  const navigate = useNavigate()
  const user = session?.user
  if (!user) return null

  const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Learner'
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase()
  const summary = summarizeProfile(progress, LEVELS)
  const joined = user.created_at ? new Date(user.created_at) : null
  const joinedLabel = joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
  const emailAccount = user.identities?.some(identity => identity.provider === 'email') || user.app_metadata?.provider === 'email'
  const displayedSolutions = showAllSolutions ? summary.solutions : summary.solutions.slice(0, 5)

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

  function downloadProgress() {
    try {
      const blob = new Blob([JSON.stringify({ app: 'Praxis', version: 1, exportedAt: new Date().toISOString(), progress }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `praxis-progress-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('Could not download your progress. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-1">
      <AppHeader left={<BackNav to="/" label="Home" title="Back to home" />} right={<Link to="/levels" className="text-sm font-bold text-accent min-h-11 inline-flex items-center"><span className="sm:hidden">Learn →</span><span className="hidden sm:inline">Continue learning →</span></Link>} />
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-7">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-bold text-teal mb-2">Your learning space</p>
          <h1 className="text-3xl font-extrabold tracking-tight">My profile</h1>
          <p className={`${secondaryText} mt-2`}>Track your progress, revisit your work, and make Praxis yours.</p>
        </div>

        <section aria-label="Profile overview" className={`${cardClass} flex flex-wrap items-center gap-5`}>
          <div aria-hidden="true" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-accent/10 border border-accent/20 text-accent text-2xl font-extrabold flex items-center justify-center shrink-0">{initials || 'P'}</div>
          <div className="min-w-0 basis-40 flex-1">
            <h2 className="text-2xl font-bold break-words">{name}</h2>
            <p className={`${secondaryText} break-all`}>{user.email || 'Connected account'}</p>
            {joinedLabel && <p className="text-xs text-text-3 mt-2">Learning with Praxis since {joinedLabel}</p>}
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${hasCompletedTutorial ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-accent border border-blue-200'}`}>{hasCompletedTutorial ? 'Tutorial completed' : 'Getting started'}</span>
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
                  const completion = level.total ? Math.round(level.completed / level.total * 100) : 0
                  return <div key={level.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2"><span className="font-semibold text-sm">{level.name}</span><span className="text-xs text-text-3">{level.completed} / {level.total} stages</span></div>
                    <div role="progressbar" aria-label={`${level.name} completion`} aria-valuemin={0} aria-valuemax={level.total} aria-valuenow={level.completed} className="h-2 rounded-full bg-bg overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completion}%` }} /></div>
                    <div className="mt-2 flex justify-between gap-3 text-xs">
                      <span className="text-text-3">{locked ? level.id === 1 || !hasCompletedTutorial ? 'Complete the tutorial to unlock' : `Complete Level ${level.id - 1} with ${UNLOCK_AVERAGE_SCORE}% average to unlock` : completion === 100 ? 'All stages completed' : `${completion}% complete`}</span>
                      {!locked && <Link className="text-accent font-bold shrink-0" to={`/level/${level.id}/stages`}>{level.completed ? 'View stages' : 'Get started'} →</Link>}
                    </div>
                  </div>
                })}
              </div>
            </section>

            <section className={cardClass} aria-labelledby="profile-solutions-title">
              <h2 id="profile-solutions-title" className={sectionTitle}>Saved derivations</h2>
              <p className={`${secondaryText} mt-1 mb-4`}>Revisit the laws and steps behind your completed solutions.</p>
              {summary.solutions.length ? <>
                <ul className="divide-y divide-border">
                  {displayedSolutions.map(solution => <li key={solution.key} className="py-3 first:pt-0">
                    <Link to={`/level/${solution.levelId}/stage/${solution.stageIdx + 1}${solution.levelId === 0 ? '?tutorial=false' : ''}`} className="group flex items-center justify-between gap-3 rounded-lg focus-visible:outline-accent">
                      <div className="min-w-0"><p className="text-sm font-bold group-hover:text-accent">{solution.levelName} · Stage {solution.stageIdx + 1}</p><p className="font-mono text-xs text-text-3 truncate mt-1">{solution.puzzle.expr}</p><p className="text-xs text-text-3 mt-1">{solution.steps.length} step{solution.steps.length === 1 ? '' : 's'}{solution.score !== null ? ` · Best score ${solution.score}%` : ''}</p></div><span aria-hidden="true" className="text-accent">→</span>
                    </Link>
                  </li>)}
                </ul>
                {summary.solutions.length > 5 && <button type="button" className="mt-3 text-sm font-bold text-accent min-h-11" onClick={() => setShowAllSolutions(value => !value)}>{showAllSolutions ? 'Show fewer solutions' : `Show all ${summary.solutions.length} solutions`}</button>}
              </> : <div className="rounded-xl border border-dashed border-border bg-bg p-5"><p className="text-sm font-semibold">Your first solution starts here.</p><p className={`${secondaryText} mt-1`}>Complete a stage and your derivation will appear here for review.</p><Link to={hasCompletedTutorial ? '/levels' : '/level/0/stages'} className="inline-flex text-sm text-accent font-bold mt-3 min-h-11 items-center">{hasCompletedTutorial ? 'Choose a level' : 'Start the tutorial'} →</Link></div>}
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
              <div className="flex items-center justify-between gap-4 mt-4"><div><p className="text-sm font-semibold">Sound effects</p><p className="text-xs text-text-3 mt-1">{soundEnabled ? 'On' : 'Off'} · Saved on this device</p></div><SoundToggle enabled={soundEnabled} onToggle={toggleSound} /></div>
            </section>

            {emailAccount && <section className={cardClass} aria-labelledby="profile-password-title"><h2 id="profile-password-title" className={sectionTitle}>Password</h2><p className={`${secondaryText} mt-1 mb-5`}>Update the password you use to sign in.</p><PasswordForm key={user.id} /></section>}

            <section className={cardClass} aria-labelledby="profile-data-title">
              <h2 id="profile-data-title" className={sectionTitle}>Your progress, with you</h2>
              <p className={`${secondaryText} mt-2 mb-4`}>Download a JSON copy of your points, stage scores, and saved derivations.</p>
              <button type="button" onClick={downloadProgress} className="min-h-11 px-4 py-2 rounded-xl border border-border text-sm font-bold hover:bg-bg">Download progress</button>
              <div className="border-t border-border mt-5 pt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-3">Signed in on this device</p><button type="button" disabled={signingOut} onClick={() => setShowSignOut(true)} className="text-sm font-bold text-red-600 min-h-11 px-2 disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
            </section>
          </div>
        </div>
      </main>
      <SignOutConfirmModal show={showSignOut} onClose={() => { if (!signingOut) setShowSignOut(false) }} onConfirm={handleSignOut} />
    </div>
  )
}
