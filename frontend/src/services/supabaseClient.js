/**
 * Supabase client — the app's only connection to the auth backend.
 * Credentials come from Vite env vars (see frontend/.env.local).
 *
 * The SDK is imported lazily: it is ~50 kB gzipped and the first paint never
 * needs it synchronously. Everything that talks to auth awaits getSupabase(),
 * which memoises the single client promise so repeated calls share one instance.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

let clientPromise = null

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase is not configured for this build.')
        }
        return createClient(supabaseUrl, supabaseKey)
      })
      .catch((error) => {
        // A transient import failure must not poison the memo forever.
        clientPromise = null
        throw error
      })
  }
  return clientPromise
}
