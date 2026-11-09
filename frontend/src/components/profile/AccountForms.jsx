import { useState } from 'react'
import { updatePassword, updateProfile } from '../../services/authActions.js'
import PasswordField from '../ui/PasswordField.jsx'

const inputClass = 'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'
const buttonClass = 'min-h-11 px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'

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
      <div><label htmlFor="profile-name" className="block text-sm font-semibold text-text-2 mb-2">Display name</label><input id="profile-name" autoComplete="nickname" required maxLength={60} value={name} onChange={event => { setName(event.target.value); setFeedback(null) }} className={inputClass} disabled={busy} /></div>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" className={buttonClass} disabled={busy || !dirty || !name.trim()}>{busy ? 'Saving…' : 'Save changes'}</button>
        {dirty && <button type="button" disabled={busy} className="text-sm text-text-2 min-h-11 px-2" onClick={() => { setName(currentName); setFeedback(null) }}>Cancel</button>}
      </div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm ${feedback.error ? 'text-red-600' : 'text-emerald-700'}`}>{feedback.message}</p>}
    </form>
  )
}

export function PasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function save(event) {
    event.preventDefault()
    if (busy) return
    if (password.length < 6 || password !== confirmation) {
      setFeedback({ error: true, message: password.length < 6 ? 'Use at least 6 characters.' : 'Passwords do not match.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const { error } = await updatePassword(password)
      if (error) throw error
      setPassword('')
      setConfirmation('')
      setFeedback({ message: 'Your password has been updated.' })
    } catch (error) {
      setFeedback({ error: true, message: error.message || 'Could not update your password. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <PasswordField id="profile-password" label="New password" value={password} onChange={event => { setPassword(event.target.value); setFeedback(null) }} autoComplete="new-password" required placeholder="At least 6 characters" />
        <PasswordField id="profile-confirm-password" label="Confirm new password" value={confirmation} onChange={event => { setConfirmation(event.target.value); setFeedback(null) }} autoComplete="new-password" required />
      </fieldset>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm ${feedback.error ? 'text-red-600' : 'text-emerald-700'}`}>{feedback.message}</p>}
      <button type="submit" disabled={busy || !password || !confirmation} className={buttonClass}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>
  )
}
