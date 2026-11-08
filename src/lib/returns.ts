import type { Asset, AssetGroup, Movement } from '../types'
import { binancePair, cedearRatioOf, underlyingTicker, yahooSymbol } from './market'
import { toRateDate } from './portfolio'
import type { SpyClose } from './spy'
import { supabase } from './supabase'

export interface ReturnPoint {
  date: string
  portfolio: number
  spy: number
}

export interface ReturnLines {
  points: ReturnPoint[]
  flat: string[]
}

type TrackMode = 'yahoo-usd' | 'yahoo-ars' | 'crypto' | 'ratio' | 'flat-usd' | 'flat-ars'

interface Track {
  asset: Asset
  mode: TrackMode
  key: string
  ratio: number
  flat: number
}

function closeOn(series: SpyClose[] | undefined, date: string): number | null {
  if (!series || series.length === 0) return null
  let lo = 0
  let hi = series.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (series[mid].date <= date) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found >= 0 ? series[found].close : null
}

function rateOn(dates: string[], rates: number[], date: string): number | null {
  if (dates.length === 0) return null
  let lo = 0
  let hi = dates.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (dates[mid] <= date) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (found >= 0) return rates[found]
  return rates[0]
}

function trackOf(asset: Asset, group: AssetGroup | undefined): Track {
  const ratio = cedearRatioOf(asset, group)
  const underlying = underlyingTicker(asset, group)
  if (ratio && underlying) {
    return { asset, mode: 'ratio', key: underlying, ratio, flat: 0 }
  }
  const pair = binancePair(asset)
  if (pair) return { asset, mode: 'crypto', key: pair, ratio: 1, flat: 0 }
  const symbol = yahooSymbol(asset)
  if (symbol) {
    return {
      asset,
      mode: asset.currency === 'ARS' ? 'yahoo-ars' : 'yahoo-usd',
      key: symbol,
      ratio: 1,
      flat: 0,
    }
  }
  const price = Number(asset.current_price)
  return {
    asset,
    mode: asset.currency === 'ARS' ? 'flat-ars' : 'flat-usd',
    key: '',
    ratio: 1,
    flat: price > 0 ? price : 1,
  }
}

function unitUsd(
  track: Track,
  date: string,
  market: Record<string, SpyClose[]>,
  rateDates: string[],
  rateValues: number[],
): number | null {
  if (track.mode === 'flat-usd') return track.flat
  if (track.mode === 'flat-ars') {
    const fx = rateOn(rateDates, rateValues, date)
    return fx && fx > 0 ? track.flat / fx : null
  }
  if (track.mode === 'ratio') {
    const usd = closeOn(market[track.key], date)
    return usd && usd > 0 ? usd / track.ratio : null
  }
  const close = closeOn(market[track.key], date)
  if (!(close && close > 0)) return null
  if (track.mode === 'yahoo-usd' || track.mode === 'crypto') return close
  const fx = rateOn(rateDates, rateValues, date)
  return fx && fx > 0 ? close / fx : null
}

export function buildPriceReturns(input: {
  assets: Asset[]
  groups: AssetGroup[]
  movements: Movement[]
  rateMap: Map<string, number>
  spy: SpyClose[]
  market: Record<string, SpyClose[]>
}): ReturnLines | null {
  if (input.spy.length === 0 || input.movements.length === 0) return null

  const groups = new Map(input.groups.map((group) => [group.id, group]))
  const assets = new Map(input.assets.map((asset) => [asset.id, asset]))
  const tracks = new Map<string, Track>()
  const flat: string[] = []
  for (const asset of input.assets) {
    const group = asset.group_id ? groups.get(asset.group_id) : undefined
    const track = trackOf(asset, group)
    tracks.set(asset.id, track)
    if ((track.mode === 'flat-ars' || track.mode === 'flat-usd') && asset.asset_type !== 'fiat') {
      flat.push(asset.symbol)
    }
  }

  const rateDates: string[] = []
  const rateValues: number[] = []
  for (const [date, rate] of [...input.rateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (rate > 0) {
      rateDates.push(date)
      rateValues.push(rate)
    }
  }

  const moves = [...input.movements].sort(
    (a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime() || a.created_at.localeCompare(b.created_at),
  )
  const firstDate = toRateDate(moves[0].traded_at)
  const lastMove = toRateDate(moves[moves.length - 1].traded_at)
  const session = input.spy.filter((bar) => bar.date >= firstDate)
  if (session.length === 0) return null
  const days =
    lastMove > session[session.length - 1].date
      ? [...session, { date: lastMove, close: session[session.length - 1].close }]
      : session
  let moveIndex = 0

  const qty = new Map<string, number>()
  const unit = new Map<string, number>()
  let index = 1
  let started = false
  let spyBase = 0
  const points: ReturnPoint[] = []

  const mark = () => {
    let value = 0
    for (const [id, quantity] of qty) {
      if (!(quantity > 0)) continue
      const price = unit.get(id)
      if (price && price > 0) value += quantity * price
    }
    return value
  }

  for (const day of days) {
    const valueStart = mark()
    let flow = 0
    while (moveIndex < moves.length && toRateDate(moves[moveIndex].traded_at) <= day.date) {
      const movement = moves[moveIndex]
      moveIndex += 1
      const asset = assets.get(movement.asset_id)
      const track = tracks.get(movement.asset_id)
      if (!asset || !track) continue
      const quantity = Number(movement.quantity)
      const price = Number(movement.price_per_unit)
      const fees = Number(movement.fees)
      if (!(quantity > 0) || !(price >= 0)) continue
      const held = qty.get(asset.id) ?? 0
      const used = movement.movement_type === 'sell' ? Math.min(quantity, held) : quantity
      if (!(used > 0)) continue
      const native = movement.movement_type === 'buy' ? used * price + fees : used * price - fees
      const fx = asset.currency === 'ARS' ? rateOn(rateDates, rateValues, day.date) : 1
      if (!fx || !(fx > 0)) continue
      const cash = native / fx
      if (movement.movement_type === 'buy') {
        qty.set(asset.id, held + used)
        flow += cash
        if (!(unit.get(asset.id) && unit.get(asset.id)! > 0)) unit.set(asset.id, price / fx)
      } else {
        qty.set(asset.id, held - used)
        flow -= cash
      }
    }

    for (const track of tracks.values()) {
      const price = unitUsd(track, day.date, input.market, rateDates, rateValues)
      if (price && price > 0) unit.set(track.asset.id, price)
    }

    const valueEnd = mark()
    if (!started) {
      if (valueEnd > 0) {
        started = true
        spyBase = day.close
        points.push({ date: day.date, portfolio: 0, spy: 0 })
      }
      continue
    }
    if (valueStart >= 1) {
      const change = (valueEnd - valueStart - flow) / valueStart
      if (Number.isFinite(change)) index *= 1 + change
    }
    points.push({
      date: day.date,
      portfolio: (index - 1) * 100,
      spy: spyBase > 0 ? (day.close / spyBase - 1) * 100 : 0,
    })
  }

  if (points.length === 0) return null
  return { points, flat }
}

export async function fetchYahooSeries(symbols: string[], start: string): Promise<Record<string, SpyClose[]>> {
  const out: Record<string, SpyClose[]> = {}
  for (let offset = 0; offset < symbols.length; offset += 8) {
    const chunk = symbols.slice(offset, offset + 8)
    const { data, error } = await supabase.functions.invoke('quotes', {
      body: { series: chunk, start },
    })
    if (error) throw new Error('No se pudo leer el histórico de precios')
    const series = (data as { series?: Record<string, SpyClose[]> } | null)?.series ?? {}
    for (const [symbol, rows] of Object.entries(series)) {
      out[symbol] = (rows ?? []).filter((row) => row.close > 0)
    }
  }
  return out
}

async function fetchKlines(pair: string, startMs: number): Promise<SpyClose[]> {
  const points: SpyClose[] = []
  let cursor = startMs
  for (let page = 0; page < 6; page += 1) {
    const response = await fetch(
      `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1d&startTime=${cursor}&limit=1000`,
    )
    if (!response.ok) break
    const rows = (await response.json()) as unknown[]
    if (!Array.isArray(rows) || rows.length === 0) break
    for (const row of rows) {
      if (!Array.isArray(row)) continue
      const open = Number(row[0])
      const close = Number(row[4])
      if (!(open > 0) || !(close > 0)) continue
      points.push({ date: new Date(open).toISOString().slice(0, 10), close })
    }
    const lastOpen = Number((rows[rows.length - 1] as number[])[0])
    if (rows.length < 1000 || !(lastOpen > cursor)) break
    cursor = lastOpen + 86_400_000
  }
  return points
}

export async function fetchCryptoSeries(pairs: string[], start: string): Promise<Record<string, SpyClose[]>> {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const out: Record<string, SpyClose[]> = {}
  await Promise.all(
    pairs.map(async (pair) => {
      try {
        out[pair] = await fetchKlines(pair, startMs)
      } catch {
        out[pair] = []
      }
    }),
  )
  return out
}

export function seriesKeys(assets: Asset[], groups: AssetGroup[]): { yahoo: string[]; crypto: string[] } {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const yahoo = new Set<string>()
  const crypto = new Set<string>()
  for (const asset of assets) {
    const group = asset.group_id ? groupById.get(asset.group_id) : undefined
    const track = trackOf(asset, group)
    if (track.mode === 'crypto') crypto.add(track.key)
    if (track.mode === 'yahoo-usd' || track.mode === 'yahoo-ars' || track.mode === 'ratio') yahoo.add(track.key)
  }
  return { yahoo: [...yahoo], crypto: [...crypto] }
}
