import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DailyFxRate } from '../types'

export function useDailyFxRates() {
  const [rates, setRates] = useState<DailyFxRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('daily_fx_rates')
      .select('*')
      .order('rate_date', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setRates(data as DailyFxRate[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upsertRate = async (rateDate: string, usdArsRate: number, notes = '') => {
    const { error: upsertError } = await supabase.from('daily_fx_rates').upsert({
      rate_date: rateDate,
      usd_ars_rate: usdArsRate,
      notes: notes.trim() || null,
    })
    if (upsertError) throw upsertError
    await refresh()
  }

  const deleteRate = async (rateDate: string) => {
    const { error: deleteError } = await supabase
      .from('daily_fx_rates')
      .delete()
      .eq('rate_date', rateDate)
    if (deleteError) throw deleteError
    await refresh()
  }

  const rateMap = new Map(rates.map((rate) => [rate.rate_date, Number(rate.usd_ars_rate)]))

  return {
    rates,
    rateMap,
    loading,
    error,
    refresh,
    upsertRate,
    deleteRate,
  }
}
