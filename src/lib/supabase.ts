import { createClient } from '@supabase/supabase-js'

export const recoveryRequested =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local',
  )
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
)
