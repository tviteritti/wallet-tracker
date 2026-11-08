import { useEffect, useMemo, useState } from 'react'
import {
  buildPriceReturns,
  fetchCryptoSeries,
  fetchYahooSeries,
  seriesKeys,
  type ReturnLines,
} from '../lib/returns'
import { toRateDate } from '../lib/portfolio'
import type { SpyClose } from '../lib/spy'
import type { Asset, AssetGroup, Movement } from '../types'

export function useReturnLines(
  enabled: boolean,
  input: {
    assets: Asset[]
    groups: AssetGroup[]
    movements: Movement[]
    rateMap: Map<string, number>
    spy: SpyClose[]
  },
) {
  const [lines, setLines] = useState<ReturnLines | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const key = useMemo(() => {
    const assets = input.assets
      .map((asset) =>
        [
          asset.id,
          asset.symbol,
          asset.asset_type,
          asset.currency,
          asset.cedear_ratio ?? '',
          asset.group_id ?? '',
          asset.venue ?? '',
        ].join(':'),
      )
      .join(',')
    const groups = input.groups.map((group) => `${group.id}:${group.kind}:${group.cedear_ratio}`).join(',')
    const movements = input.movements
      .map((movement) =>
        [
          movement.id,
          movement.traded_at,
          movement.quantity,
          movement.price_per_unit,
          movement.fees,
          movement.movement_type,
        ].join(':'),
      )
      .join(',')
    const rates = [...input.rateMap.entries()].map(([date, rate]) => `${date}:${rate}`).join(',')
    const spy = input.spy.length
      ? `${input.spy[0].date}:${input.spy[input.spy.length - 1].date}:${input.spy.length}`
      : ''
    return `${assets}#${groups}#${movements}#${rates}#${spy}`
  }, [input.assets, input.groups, input.movements, input.rateMap, input.spy])

  useEffect(() => {
    if (!enabled || input.spy.length === 0 || input.movements.length === 0) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    const first = [...input.movements].sort(
      (a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime(),
    )[0]
    const startDate = new Date(`${toRateDate(first.traded_at)}T00:00:00Z`)
    startDate.setUTCDate(startDate.getUTCDate() - 7)
    const start = startDate.toISOString().slice(0, 10)
    const keys = seriesKeys(input.assets, input.groups)

    Promise.all([
      keys.yahoo.length > 0 ? fetchYahooSeries(keys.yahoo, start) : Promise.resolve({}),
      keys.crypto.length > 0 ? fetchCryptoSeries(keys.crypto, start) : Promise.resolve({}),
    ])
      .then(([yahoo, crypto]) => {
        if (cancelled) return
        const built = buildPriceReturns({
          assets: input.assets,
          groups: input.groups,
          movements: input.movements,
          rateMap: input.rateMap,
          spy: input.spy,
          market: { ...yahoo, ...crypto },
        })
        setLines(built)
        setStatus(built ? 'ready' : 'error')
        if (!built) setError('No hay suficientes precios para dibujar la evolución')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'No se pudo leer el histórico de precios')
      })

    return () => {
      cancelled = true
    }
  }, [enabled, key])

  return { lines, status, error }
}
