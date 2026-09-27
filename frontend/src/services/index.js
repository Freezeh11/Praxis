/**
 * Service layer — public API.
 *
 * Components import from here (or from a specific *Api module) and never call
 * fetch themselves. Auth and Supabase clients live here too, so there is exactly
 * one place that knows about the backend.
 */
export { apiRequest, ApiError } from './apiClient.js'
export { getLevelSummaries, getLaws, fetchLevel } from './contentApi.js'
export { submitScore } from './scoreApi.js'
export { loadProgress, saveProgress } from './progressApi.js'
export { supabase } from './supabaseClient.js'
export { AuthProvider } from '../state/AuthProvider.jsx'
export { useSession } from '../state/useSession.js'
export { signIn, signUp, signOut } from './authActions.js'
