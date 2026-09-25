import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Asset, AssetFormData, Movement, MovementFormData } from '../types'

export function usePortfolio() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [assetsRes, movementsRes] = await Promise.all([
      supabase.from('assets').select('*').order('name'),
      supabase.from('movements').select('*').order('traded_at', { ascending: false }),
    ])

    if (assetsRes.error || movementsRes.error) {
      setError(assetsRes.error?.message ?? movementsRes.error?.message ?? 'Error al cargar')
      setLoading(false)
      return
    }

    setAssets(assetsRes.data as Asset[])
    setMovements(movementsRes.data as Movement[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createAsset = async (data: AssetFormData) => {
    const { error: insertError } = await supabase.from('assets').insert({
      name: data.name.trim(),
      symbol: data.symbol.trim().toUpperCase(),
      asset_type: data.asset_type,
      currency: data.currency,
      current_price: data.current_price,
      notes: data.notes.trim() || null,
    })
    if (insertError) throw insertError
    await refresh()
  }

  const updateAsset = async (id: string, data: Partial<AssetFormData>) => {
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.symbol !== undefined) payload.symbol = data.symbol.trim().toUpperCase()
    if (data.asset_type !== undefined) payload.asset_type = data.asset_type
    if (data.currency !== undefined) payload.currency = data.currency
    if (data.current_price !== undefined) payload.current_price = data.current_price
    if (data.notes !== undefined) payload.notes = data.notes.trim() || null

    const { error: updateError } = await supabase.from('assets').update(payload).eq('id', id)
    if (updateError) throw updateError
    await refresh()
  }

  const deleteAsset = async (id: string) => {
    const { error: deleteError } = await supabase.from('assets').delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  const createMovement = async (assetId: string, data: MovementFormData) => {
    const { error: insertError } = await supabase.from('movements').insert({
      asset_id: assetId,
      movement_type: data.movement_type,
      quantity: data.quantity,
      price_per_unit: data.price_per_unit,
      fees: data.fees,
      traded_at: data.traded_at,
      notes: data.notes.trim() || null,
    })
    if (insertError) throw insertError
    await refresh()
  }

  const deleteMovement = async (id: string) => {
    const { error: deleteError } = await supabase.from('movements').delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  return {
    assets,
    movements,
    loading,
    error,
    refresh,
    createAsset,
    updateAsset,
    deleteAsset,
    createMovement,
    deleteMovement,
  }
}
