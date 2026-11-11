import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AppHeader from '../components/layout/AppHeader.jsx'
import Icon from '../components/ui/Icon.jsx'
import { NameForm, PasswordForm } from '../components/profile/AccountForms.jsx'
import UserAvatar from '../components/profile/UserAvatar.jsx'
import SignOutConfirmModal from '../components/ui/SignOutConfirmModal.jsx'
import { LEVELS } from '../content/gameContent.js'
import { UNLOCK_AVERAGE_SCORE } from '../config/gameRules.js'
import useSoundEnabled from '../hooks/useSoundEnabled.js'
import { signOut } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'
import { useProgress } from '../state/useProgress.js'
import { summarizeProfile } from '../state/profileSummary.js'
import { useTheme } from '../state/theme.js'

/**
 * Profile page visual contract: one primary action (Continue learning) in the
 * identity band, a single compact KPI strip, one collapsible row per level with
 * only the current level open by default, and one Account card that shows a
 * single settings form at a time.
 */
const panelClass = 'rounded-2xl border border-slate-200/90 bg-white shadow-panel transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)]'
const sectionTitle = 'text-base font-bold text-slate-900 dark:text-white'
const mutedText = 'text-sm text-slate-600 dark:text-slate-300'
const captionText = 'text-xs text-slate-500 dark:text-slate-400'
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-cyan-400'
const primaryCta = 'group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-colors duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-[#0B0F19]'
const microButton = 'inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 ' + focusRing + ' dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'
const disclosureButton = 'inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 ' + focusRing + ' dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
const pillClass = 'inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-1.5 text-xs font-bold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 ' + focusRing + ' dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'
const RING_CIRCUMFERENCE = 2 * Math.PI * 16

function RadialRing({ percent, className = 'h-8 w-8' }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  return (
    <svg viewBox="0 0 40 40" className={className + ' -rotate-90'} role="img" aria-label={clamped + '% complete'}>
      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-800" />
      <circle
        cx="20" cy="20" r="16" fill="none" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * clamped) / 100}
        className="stroke-indigo-500 transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none dark:stroke-cyan-400"
      />
    </svg>
  )
}

// One KPI, one card. The header row is pinned to the 2rem badge height so every
// card in the grid keeps the same rhythm whether the label takes one line or
// two; the value and caption then sit on the same baseline across all four.
function Kpi({ label, value, caption, indicator }) {
  return (
    <div className={panelClass + ' flex h-full flex-col p-4 sm:p-5'}>
      <div className="flex min-h-8 items-start justify-between gap-2">
        <dt className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-[11px] dark:text-slate-400">{label}</dt>
        <span className="shrink-0">{indicator}</span>
      </div>
      <dd className="mt-2.5 min-w-0">
        <p className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
        <p className="mt-1 truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400" title={caption}>{caption}</p>
      </dd>
    </div>
  )
}

function LevelRow({ level, isActive, isOpen, onToggle }) {
  const { id, name, locked, completed, total, completion, mastery, missingStages, lockMessage } = level
  const hasDetail = id > 0 && !locked
  const detailId = 'profile-level-detail-' + id
  const requirementMet = mastery.avgScore >= UNLOCK_AVERAGE_SCORE
  const isFinalLevel = id === LEVELS.at(-1).id

  return (
    <div className="border-t border-slate-200/80 py-3 first:border-t-0 first:pt-0 last:pb-0 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h3>
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                <Icon name="lock" /> Locked
              </span>
            )}
            {isActive && (
              <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300">
                In progress
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <div
              role="progressbar"
              aria-label={name + ' completion'}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={completed}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/70 shadow-[inset_0_1px_1px_rgba(15,23,42,0.08)] dark:bg-slate-800"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-[0_1px_3px_rgba(79,70,229,0.35)] transition-[width] duration-500 motion-reduce:transition-none dark:from-indigo-500 dark:to-cyan-400" style={{ width: completion + '%' }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{completed} / {total}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!locked && (
            <Link to={'/level/' + id + '/stages'} className={microButton}>
              View stages <span aria-hidden="true">→</span>
            </Link>
          )}
          {hasDetail && (
            <button type="button" aria-expanded={isOpen} aria-controls={detailId} onClick={onToggle} className={disclosureButton}>
              <span>{isOpen ? 'Hide' : 'Details'}</span>
              <span className="sr-only"> for {name}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={'transition-transform duration-200 motion-reduce:transition-none ' + (isOpen ? 'rotate-180' : '')}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {locked && lockMessage && <p className={'mt-1.5 ' + captionText}>{lockMessage}</p>}
      {hasDetail && (
        <div id={detailId} hidden={!isOpen} className="mt-3 rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-inset-soft dark:border-white/10 dark:bg-slate-950/40">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Level average <span className="font-bold text-slate-900 dark:text-white">{mastery.avgScore}%</span>
            <span className="text-slate-500 dark:text-slate-400"> / {UNLOCK_AVERAGE_SCORE}% required</span>
            <span className={'ml-1.5 font-semibold ' + (requirementMet ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400')}>
              · {requirementMet ? 'Requirement met' : (UNLOCK_AVERAGE_SCORE - mastery.avgScore) + ' points short'}
            </span>
          </p>
          <p className={'mt-1 ' + captionText}>Unscored stages count as zero.</p>
          {missingStages.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span>Needs a score:</span>
              {missingStages.map(index => (
                <Link key={index} to={'/level/' + id + '/stage/' + (index + 1)} className={pillClass} aria-label={'Play stage ' + (index + 1)}>{index + 1}</Link>
              ))}
              <span className="sr-only">{mastery.unlocked ? 'Ready for the next level.' : 'Complete all stages and improve low scores to progress.'}</span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Every stage has a score. {mastery.unlocked ? (isFinalLevel ? 'Final level mastered.' : 'Ready for the next level.') : 'Complete all stages and improve low scores to progress.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const { progress, getLevelProgress, hasCompletedTutorial } = useProgress()
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()
  const { theme, toggleTheme } = useTheme()
  const [showSignOut, setShowSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [accountTab, setAccountTab] = useState('name')
  const [openLevelId, setOpenLevelId] = useState(undefined)
  const navigate = useNavigate()
  const user = session?.user
  if (!user) return null

  const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Learner'
  const avatarSeed = String(user.id || user.email || name)
  const summary = summarizeProfile(progress, LEVELS)
  const joined = user.created_at ? new Date(user.created_at) : null
  const joinedLabel = joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
  const emailAccount = user.identities?.some(identity => identity.provider === 'email') || user.app_metadata?.provider === 'email'
  const stagesPercent = summary.total ? Math.round(summary.completed / summary.total * 100) : 0

  const levelRows = summary.levelProgress.map(level => {
    const previousLevel = LEVELS.find(previous => previous.id === level.id - 1)
    const locked = level.id === 1 ? !hasCompletedTutorial : level.id > 1 && (!hasCompletedTutorial || !getLevelProgress(previousLevel.id, previousLevel.puzzles.length).unlocked)
    const mastery = getLevelProgress(level.id, level.total)
    const missingStages = level.puzzles.map((_, index) => index).filter(index => !Number.isFinite(progress.stageScores?.[level.id + ':' + index]))
    const completion = level.total ? Math.round(level.completed / level.total * 100) : 0
    const lockMessage = locked
      ? (level.id === 1 || !hasCompletedTutorial ? 'Complete the tutorial to unlock' : 'Complete Level ' + (level.id - 1) + ' with ' + UNLOCK_AVERAGE_SCORE + '% average to unlock')
      : null
    return { ...level, locked, mastery, missingStages, completion, lockMessage }
  })
  const activeLevelId = levelRows.find(row => row.id > 0 && !row.locked && row.completed < row.total)?.id ?? null
  const visibleLevelId = openLevelId === undefined ? activeLevelId : openLevelId
  const accountTabs = emailAccount
    ? [{ id: 'name', label: 'Display name' }, { id: 'password', label: 'Password' }, { id: 'email', label: 'Email' }]
    : [{ id: 'name', label: 'Display name' }, { id: 'email', label: 'Email' }]

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
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100">
      <AppHeader crumbs={[{ label: 'My Profile' }]} showThemeToggle={false} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">My profile</h1>
          <p className={'mt-1.5 ' + mutedText}>Your progress, preferences and account in one place.</p>
        </div>

        <div className="space-y-6">
          <section aria-label="Profile overview" className={panelClass + ' p-5 sm:p-6'}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatar seed={avatarSeed} name={name} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="break-words text-xl font-bold text-slate-900 dark:text-white">{name}</h2>
                    <span
                      tabIndex={0}
                      aria-describedby="progress-help"
                      className={'group relative inline-flex cursor-help items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ' + focusRing + ' ' + (hasCompletedTutorial
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300')}
                    >
                      {hasCompletedTutorial ? 'Tutorial completed' : 'Getting started'}
                      <span id="progress-help" role="tooltip" className="invisible absolute right-0 top-full z-30 mt-2 w-56 max-w-[calc(100vw_-_2.5rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs font-normal leading-relaxed text-slate-700 opacity-0 shadow-lg group-focus:visible group-focus:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                        Finish all four tutorial stages to unlock Level 1. Then complete every stage in each level with at least {UNLOCK_AVERAGE_SCORE}% average to open the next level. Replay stages to improve your best scores.
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">{user.email || 'Connected account'}</p>
                  {joinedLabel && <p className={'mt-0.5 ' + captionText}>Learning with Praxis since {joinedLabel}</p>}
                </div>
              </div>
              <Link to="/levels" className={primaryCta}>
                Continue learning
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </section>

          <section aria-label="Learning statistics">
            <dl className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi
                label="Points available"
                value={progress.points ?? 0}
                caption="Spend on guided hints"
                indicator={<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-sm text-amber-600 dark:bg-amber-400/10 dark:text-amber-300"><Icon name="bolt" /></span>}
              />
              <Kpi
                label="Stages completed"
                value={summary.completed + ' / ' + summary.total}
                caption="Tutorial and all levels"
                indicator={<RadialRing percent={stagesPercent} />}
              />
              <Kpi
                label="Average best score"
                value={summary.average === null ? '—' : summary.average + '%'}
                caption="Across scored stages"
                indicator={<RadialRing percent={summary.average ?? 0} />}
              />
              <Kpi
                label="Stars earned"
                value={summary.stars}
                caption="From your best scores"
                indicator={<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-sm text-amber-500 dark:bg-amber-400/10 dark:text-amber-300"><Icon name="star" /></span>}
              />
            </dl>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <section className={'min-w-0 ' + panelClass + ' p-5 sm:p-6'} aria-labelledby="profile-levels-title">
              <h2 id="profile-levels-title" className={sectionTitle}>Your learning journey</h2>
              <p className={'mt-1 ' + captionText}>Expand a level to see its average and the stages still missing a score.</p>
              <div className="mt-4">
                {levelRows.map(level => (
                  <LevelRow
                    key={level.id}
                    level={level}
                    isActive={level.id === activeLevelId}
                    isOpen={level.id === visibleLevelId}
                    onToggle={() => setOpenLevelId(level.id === visibleLevelId ? null : level.id)}
                  />
                ))}
              </div>
            </section>

            <div className="min-w-0 space-y-6">
              <section className={panelClass + ' p-5 sm:p-6'} aria-labelledby="profile-account-title">
                <h2 id="profile-account-title" className={sectionTitle}>Account details</h2>
                <p className={'mt-1 ' + captionText}>One setting at a time.</p>
                <div role="group" aria-label="Account settings" className="mt-3 inline-flex w-full flex-wrap gap-1 rounded-xl border border-slate-300 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-slate-950/70">
                  {accountTabs.map(tab => (
                    <button
                      key={tab.id}
                      id={tab.id === 'password' ? 'profile-password-title' : undefined}
                      type="button"
                      aria-pressed={accountTab === tab.id}
                      onClick={() => setAccountTab(tab.id)}
                      className={'inline-flex min-h-9 flex-1 items-center justify-center rounded-lg px-2.5 text-xs font-bold transition-colors duration-200 ' + focusRing + ' ' + (accountTab === tab.id
                        ? 'bg-white text-slate-900 shadow-chip dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white')}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  {accountTab === 'name' && <NameForm key={user.id} user={user} />}
                  {accountTab === 'password' && emailAccount && <PasswordForm key={user.id} />}
                  {accountTab === 'email' && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-slate-950/40">
                      <p className={'text-[11px] font-semibold uppercase tracking-wide ' + captionText}>Email address</p>
                      <p className="mt-1 break-all text-sm text-slate-800 dark:text-slate-200">{user.email || 'No email provided'}</p>
                      {user.email && <p className={'mt-1 ' + captionText}>{user.email_confirmed_at ? 'Email verified' : 'Email not yet verified'}</p>}
                    </div>
                  )}
                </div>
              </section>

              <section className={panelClass + ' p-5 sm:p-6'} aria-labelledby="profile-preferences-title">
                <h2 id="profile-preferences-title" className={sectionTitle}>Preferences</h2>
                <div className="mt-2 divide-y divide-slate-200/80 dark:divide-white/10">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon name="sun" className="text-base text-slate-400 dark:text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</p>
                    </div>
                    <div role="group" aria-label="Color theme" className="inline-flex shrink-0 rounded-xl border border-slate-300 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-slate-950/70">
                      {['light', 'dark'].map(mode => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={theme === mode}
                          onClick={() => { if (theme !== mode) toggleTheme() }}
                          className={'inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-bold transition-colors duration-200 ' + focusRing + ' ' + (theme === mode
                            ? 'bg-white text-slate-900 shadow-chip dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white')}
                        >
                          {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon name={soundEnabled ? 'volume' : 'muted'} className="text-base text-slate-400 dark:text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Sound effects</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{soundEnabled ? 'On' : 'Off'}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={soundEnabled}
                        aria-label="Sound effects"
                        onClick={toggleSound}
                        className={'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ' + focusRing + ' ' + (soundEnabled
                          ? 'border-indigo-600 bg-indigo-600 dark:border-cyan-400 dark:bg-cyan-500'
                          : 'border-slate-300 bg-slate-200 dark:border-white/10 dark:bg-slate-700')}
                      >
                        <span className={'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.28)] transition-transform duration-200 motion-reduce:transition-none ' + (soundEnabled ? 'translate-x-5' : 'translate-x-0')} />
                      </button>
                    </div>
                  </div>
                </div>
                <p className={'mt-2 ' + captionText}>Saved on this device.</p>
              </section>
            </div>
          </div>

          <section aria-labelledby="profile-data-title" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/90 pt-5 dark:border-white/10">
            <div className="min-w-0">
              <h2 id="profile-data-title" className="text-sm font-bold text-slate-900 dark:text-white">Session</h2>
              <p className={'mt-0.5 ' + captionText}>Signed in on this device.</p>
            </div>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => setShowSignOut(true)}
              className={'inline-flex min-h-11 shrink-0 items-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-600 transition-colors duration-200 hover:bg-rose-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20'}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </section>
        </div>
      </main>
      <SignOutConfirmModal show={showSignOut} onClose={() => { if (!signingOut) setShowSignOut(false) }} onConfirm={handleSignOut} />
    </div>
  )
}
