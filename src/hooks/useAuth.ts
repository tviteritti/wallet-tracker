import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { recoveryRequested, supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(recoveryRequested)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true)
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const requestPasswordReset = async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setNeedsPassword(false)
  }

  return { session, loading, needsPassword, signIn, signOut, requestPasswordReset, updatePassword }
}
