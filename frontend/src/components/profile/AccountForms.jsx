import { useState } from 'react'
import { updatePassword, updateProfile } from '../../services/authActions.js'
import { toast } from 'sonner'
import PasswordField from '../ui/PasswordField.jsx'
import { passwordError, PASSWORD_REQUIREMENTS } from '../../services/passwordPolicy.js'

const inputClass = 'w-full rounded-xl border border-slate-300 bg-slate-100/80 px-3 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-colors duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-[#0B0F19]'

export function NameForm({ user }) {
  const currentName = user.user_metadata?.name || user.user_metadata?.full_name || ''
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const dirty = name.trim() !== currentName

  async function save(event) {
    event.preventDefault()
    if (busy || !dirty) return
    if (!name.trim() || name.trim().length > 60) {
      setFeedback({ error: true, message: 'Enter a display name between 1 and 60 characters.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const { error } = await updateProfile(name.trim())
      if (error) throw error
      setName(name.trim())
      setFeedback({ message: 'Your display name has been saved.' })
    } catch (error) {
      setFeedback({ error: true, message: error.message || 'Could not save your name. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div><label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">Display name</label><input id="profile-name" autoComplete="nickname" required maxLength={60} value={name} onChange={event => { setName(event.target.value); setFeedback(null) }} className={inputClass} disabled={busy} /></div>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" className={buttonClass} disabled={busy || !dirty || !name.trim()}>{busy ? 'Saving…' : 'Save changes'}</button>
        {dirty && <button type="button" disabled={busy} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-slate-600 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 dark:hover:text-white dark:focus-visible:ring-cyan-400" onClick={() => { setName(currentName); setFeedback(null) }}>Cancel</button>}
      </div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm ${feedback.error ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>{feedback.message}</p>}
    </form>
  )
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function save(event) {
    event.preventDefault()
    if (busy) return
    if (!currentPassword || passwordError(password) || password !== confirmation) {
      setFeedback({ error: true, message: !currentPassword ? 'Enter your current password.' : passwordError(password) || 'Passwords do not match.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const { error } = await updatePassword(password, currentPassword)
      if (error) throw error
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
      setFeedback({ message: 'Password updated. Signing you out on every device…' })
      toast.success('Password updated. Please sign in again on all devices.')
    } catch (error) {
      setFeedback({ error: true, message: error.message || 'Could not update your password. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <PasswordField id="profile-current-password" label="Current password" value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setFeedback(null) }} autoComplete="current-password" required borderClassName="border border-slate-300 focus:border-indigo-500 dark:border-white/10 dark:focus:border-cyan-400" className="rounded-xl" />
        <p className="text-xs text-slate-500 dark:text-slate-400">{PASSWORD_REQUIREMENTS}</p>
        <PasswordField id="profile-password" label="New password" value={password} onChange={event => { setPassword(event.target.value); setFeedback(null) }} autoComplete="new-password" required placeholder="At least 8 characters" borderClassName="border border-slate-300 focus:border-indigo-500 dark:border-white/10 dark:focus:border-cyan-400" className="rounded-xl" />
        <PasswordField id="profile-confirm-password" label="Confirm new password" value={confirmation} onChange={event => { setConfirmation(event.target.value); setFeedback(null) }} autoComplete="new-password" required borderClassName="border border-slate-300 focus:border-indigo-500 dark:border-white/10 dark:focus:border-cyan-400" className="rounded-xl" />
      </fieldset>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm ${feedback.error ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>{feedback.message}</p>}
      <button type="submit" disabled={busy || !currentPassword || !password || !confirmation} className={buttonClass}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>
  )
}
