import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMarket, sameAmount, type DollarRates, type QuotedPrice } from '../lib/market'
import type { Asset, AssetGroup } from '../types'

const REFRESH_MS = 60_000

interface UseLiveQuotesOptions {
  assets: Asset[]
  groups: AssetGroup[]
  ready: boolean
  usdArsRate: number
  freezeRate: boolean
  savePrices: (updates: { id: string; current_price: number }[]) => Promise<void>
  saveUsdArs: (rate: number) => Promise<void>
}

export interface LiveQuotesState {
  refreshing: boolean
  updatedAt: Date | null
  error: string | null
  fx: DollarRates | null
  btcUsd: number | null
  prices: Record<string, QuotedPrice>
  refresh: () => void
}

export function useLiveQuotes({
  assets,
  groups,
  ready,
  usdArsRate,
  freezeRate,
  savePrices,
  saveUsdArs,
}: UseLiveQuotesOptions): LiveQuotesState {
  const assetsRef = useRef(assets)
  const groupsRef = useRef(groups)
  const rateRef = useRef(usdArsRate)
  const freezeRef = useRef(freezeRate)
  const readyRef = useRef(ready)
  const savePricesRef = useRef(savePrices)
  const saveUsdArsRef = useRef(saveUsdArs)
  const requestId = useRef(0)

  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fx, setFx] = useState<DollarRates | null>(null)
  const [btcUsd, setBtcUsd] = useState<number | null>(null)
  const [prices, setPrices] = useState<Record<string, QuotedPrice>>({})

  const signature = assets
    .map((asset) =>
      [
        asset.id,
        asset.symbol,
        asset.asset_type,
        asset.currency,
        asset.venue ?? '',
        asset.cedear_ratio ?? '',
        asset.group_id ?? '',
      ].join(':'),
    )
    .join('|')
  const groupSignature = groups
    .map((group) => [group.id, group.kind, group.cedear_ratio].join(':'))
    .join('|')

  useEffect(() => {
    assetsRef.current = assets
    groupsRef.current = groups
    rateRef.current = usdArsRate
    freezeRef.current = freezeRate
    readyRef.current = ready
    savePricesRef.current = savePrices
    saveUsdArsRef.current = saveUsdArs
  }, [assets, groups, usdArsRate, freezeRate, ready, savePrices, saveUsdArs])

  const pull = useCallback(async () => {
    if (!readyRef.current) return
    const token = ++requestId.current
    setRefreshing(true)
    try {
      const current = assetsRef.current
      const snapshot = await fetchMarket(current, groupsRef.current)
      if (token !== requestId.current) return

      const updates = current.flatMap((asset) => {
        const quote = snapshot.prices[asset.id]
        if (!quote || sameAmount(quote.price, Number(asset.current_price))) return []
        return [{ id: asset.id, current_price: quote.price }]
      })
      if (updates.length > 0) await savePricesRef.current(updates)
      if (token !== requestId.current) return

      const mep = snapshot.fx?.mep ?? 0
      if (!freezeRef.current && mep > 0 && !sameAmount(mep, rateRef.current)) {
        await saveUsdArsRef.current(mep)
      }
      if (token !== requestId.current) return

      setPrices(snapshot.prices)
      setBtcUsd(snapshot.btcUsd)
      setFx(snapshot.fx)
      setError(snapshot.error)
      setUpdatedAt(new Date())
    } catch (err) {
      if (token !== requestId.current) return
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar las cotizaciones')
    } finally {
      if (token === requestId.current) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void pull()
  }, [ready, signature, groupSignature, pull])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [pull])

  return {
    refreshing,
    updatedAt,
    error,
    fx,
    btcUsd,
    prices,
    refresh: () => {
      void pull()
    },
  }
}
