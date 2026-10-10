
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseReady = Boolean(url && key)

export const supabase = supabaseReady
  ? createClient(url, key)
  : null

export async function getGuestSession() {
  if (!supabase) {
    throw new Error('Supabase credentials are missing. Check .env.local.')
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (sessionData.session) return sessionData.session

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) throw error
  if (!data.session) throw new Error('Guest session was not created.')

  return data.session
}
