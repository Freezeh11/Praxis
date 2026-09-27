/**
 * Auth actions — the only module that calls supabase.auth mutations.
 *
 * Each returns `{ data, error: { message } | null }` so the screens can render a
 * message without knowing which auth provider is behind it.
 */
import { supabase } from './supabaseClient.js'

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
