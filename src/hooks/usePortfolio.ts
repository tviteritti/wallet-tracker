import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Asset, AssetFormData, AssetGroup, Movement, MovementFormData } from '../types'

function asNumber(value: unknown): number {
  return Number(value)
}

function mapAsset(row: Asset): Asset {
  return {
    ...row,
    current_price: asNumber(row.current_price),
    cedear_ratio: row.cedear_ratio == null ? null : asNumber(row.cedear_ratio),
  }
}

function mapGroup(row: AssetGroup): AssetGroup {
  return {
    ...row,
    cedear_ratio: asNumber(row.cedear_ratio),
    btc_per_share: asNumber(row.btc_per_share),
  }
}

export function usePortfolio() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [groups, setGroups] = useState<AssetGroup[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    setError(null)

    const [assetsRes, groupsRes, movementsRes] = await Promise.all([
      supabase.from('assets').select('*').order('name'),
      supabase.from('asset_groups').select('*').order('name'),
      supabase.from('movements').select('*').order('traded_at', { ascending: false }),
    ])

    if (assetsRes.error || groupsRes.error || movementsRes.error) {
      setError(
        assetsRes.error?.message ??
          groupsRes.error?.message ??
          movementsRes.error?.message ??
          'Error al cargar',
      )
      setLoading(false)
      return
    }

    setAssets((assetsRes.data as Asset[]).map(mapAsset))
    setGroups((groupsRes.data as AssetGroup[]).map(mapGroup))
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
      cedear_ratio: data.asset_type === 'cedear' ? data.cedear_ratio : null,
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
    if (data.cedear_ratio !== undefined) {
      payload.cedear_ratio =
        data.asset_type === 'cedear' || data.asset_type === undefined ? data.cedear_ratio : null
    }
    if (data.asset_type !== undefined && data.asset_type !== 'cedear') payload.cedear_ratio = null
    if (data.notes !== undefined) payload.notes = data.notes.trim() || null

    const { error: updateError } = await supabase.from('assets').update(payload).eq('id', id)
    if (updateError) throw updateError
    await refresh()
  }

  const updatePrices = async (updates: { id: string; current_price: number }[]) => {
    if (updates.length === 0) return
    const results = await Promise.all(
      updates.map((update) =>
        supabase.from('assets').update({ current_price: update.current_price }).eq('id', update.id),
      ),
    )
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error
    await refresh({ silent: true })
  }

  const deleteAsset = async (id: string) => {
    const { error: deleteError } = await supabase.from('assets').delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  const updateGroup = async (
    id: string,
    data: { cedear_ratio: number; btc_per_share: number },
  ) => {
    const { error: updateError } = await supabase
      .from('asset_groups')
      .update({
        cedear_ratio: data.cedear_ratio,
        btc_per_share: data.btc_per_share,
      })
      .eq('id', id)
    if (updateError) throw updateError
    await refresh()
  }

  const deleteGroup = async (id: string) => {
    const { error: deleteError } = await supabase.from('asset_groups').delete().eq('id', id)
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

  const updateMovement = async (id: string, data: MovementFormData) => {
    const { error: updateError } = await supabase
      .from('movements')
      .update({
        movement_type: data.movement_type,
        quantity: data.quantity,
        price_per_unit: data.price_per_unit,
        fees: data.fees,
        traded_at: data.traded_at,
        notes: data.notes.trim() || null,
      })
      .eq('id', id)
    if (updateError) throw updateError
    await refresh()
  }

  const deleteMovement = async (id: string) => {
    const { error: deleteError } = await supabase.from('movements').delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  return {
    assets,
    groups,
    movements,
    loading,
    error,
    refresh,
    createAsset,
    updateAsset,
    updatePrices,
    deleteAsset,
    updateGroup,
    deleteGroup,
    createMovement,
    updateMovement,
    deleteMovement,
  }
}
