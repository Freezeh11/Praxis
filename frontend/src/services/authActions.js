/**
 * Auth actions — the only module that calls supabase.auth mutations.
 *
 * Each returns `{ data, error: { message } | null }` so the screens can render a
 * message without knowing which auth provider is behind it.
 */
import { notifyAuthChanged } from '../state/authEvents.js'
import { getSupabase } from './supabaseClient.js'
import { passwordError } from './passwordPolicy.js'

export const signIn = {
  email: async ({ email, password }) => {
    const supabase = await getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    notifyAuthChanged()
    return { data, error: null }
  },
}

export const signUp = {
  email: async ({ email, password, name }) => {
    const invalid = passwordError(password)
    if (invalid) return { data: null, error: { message: invalid } }
    const supabase = await getSupabase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    notifyAuthChanged()
    return { data, error: null }
  },
}

export const signOut = async () => {
  const supabase = await getSupabase()
  return supabase.auth.signOut()
}

/**
 * Password recovery, step 1: ask Supabase to email a reset link.
 *
 * The reply is deliberately identical whether or not the address exists — this
 * screen must never become an account-existence oracle — so only transport and
 * rate-limit failures are surfaced here.
 */
export const requestPasswordReset = async (email) => {
  const address = String(email || '').trim()
  if (!address) return { error: { message: 'Enter the email address on your account.' } }
  const redirectTo = `${window.location.origin}/reset-password`
  const supabase = await getSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo })
  if (error) {
    const message = /rate limit|too many|seconds/i.test(error.message)
      ? 'Too many reset requests. Wait a minute and try again.'
      : error.message
    return { error: { message } }
  }
  return { error: null }
}

/**
 * Password recovery, step 2: set the new password on the recovery session.
 *
 * The link signs the learner in with a short-lived session; we end that session
 * right after the update so the new password is what gets used from then on, on
 * this device and everywhere else.
 */
export const resetPassword = async (password) => {
  const invalid = passwordError(password)
  if (invalid) return { error: { message: invalid } }
  const supabase = await getSupabase()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: { message: error.message } }
  await supabase.auth.signOut().catch(() => {})
  return { error: null }
}

export const updateProfile = async (name) => {
  const supabase = await getSupabase()
  return supabase.auth.updateUser({ data: { name } })
}

export const updatePassword = async (password, currentPassword) => {
  const invalid = passwordError(password)
  if (invalid) return { error: { message: invalid } }
  if (!currentPassword) return { error: { message: 'Enter your current password.' } }
  const supabase = await getSupabase()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) return { error: userError || { message: 'Sign in again to change your password.' } }
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (error) return { error: { message: 'Could not verify your current password. Check it and try again.' } }
  const { error: updateError } = await supabase.auth.updateUser({ password, current_password: currentPassword })
  if (updateError) return { error: updateError }
  // Safety: a password change revokes every refresh token, so all other devices
  // (and this one) have to sign in again with the new password.
  try {
    await supabase.auth.signOut({ scope: 'global' })
  } catch (signOutError) {
    void signOutError
    await supabase.auth.signOut().catch(() => {})
  }
  return { error: null }
}
