import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AppSettings } from '../types'

const DEFAULT_RATE = 1000

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    if (!data) {
      const { data: created, error: insertError } = await supabase
        .from('app_settings')
        .insert({ id: 1, usd_ars_rate: DEFAULT_RATE })
        .select('*')
        .single()

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      setSettings(created as AppSettings)
      setLoading(false)
      return
    }

    setSettings(data as AppSettings)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateUsdArsRate = async (rate: number) => {
    const { data, error: updateError } = await supabase
      .from('app_settings')
      .upsert({ id: 1, usd_ars_rate: rate })
      .select('*')
      .single()

    if (updateError) throw updateError
    setSettings(data as AppSettings)
  }

  return {
    settings,
    usdArsRate: Number(settings?.usd_ars_rate ?? DEFAULT_RATE),
    loading,
    error,
    refresh,
    updateUsdArsRate,
  }
}
