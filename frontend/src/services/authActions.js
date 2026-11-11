/**
 * Auth actions — the only module that calls supabase.auth mutations.
 *
 * Each returns `{ data, error: { message } | null }` so the screens can render a
 * message without knowing which auth provider is behind it.
 */
import { supabase } from './supabaseClient.js'
import { passwordError } from './passwordPolicy.js'

export const signIn = {
  email: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data, error: null }
  },
}

export const signUp = {
  email: async ({ email, password, name }) => {
    const invalid = passwordError(password)
    if (invalid) return { data: null, error: { message: invalid } }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data, error: null }
  },
}

export const signOut = async () => supabase.auth.signOut()

export const updateProfile = async (name) => supabase.auth.updateUser({ data: { name } })

export const updatePassword = async (password, currentPassword) => {
  const invalid = passwordError(password)
  if (invalid) return { error: { message: invalid } }
  if (!currentPassword) return { error: { message: 'Enter your current password.' } }
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) return { error: userError || { message: 'Sign in again to change your password.' } }
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (error) return { error: { message: 'Could not verify your current password. Check it and try again.' } }
  return supabase.auth.updateUser({ password, current_password: currentPassword })
}
