import type { Asset, Movement, PositionSummary } from '../types'
import { toRateDate } from './portfolio'
import { supabase } from './supabase'

export interface SpyClose {
  date: string
  close: number
}

interface SpyPoint {
  date: string
  invested: number
  spy: number
}

export interface SpyMonth {
  month: string
  contributed: number
  invested: number
  spy: number
}

export interface SpyComparison {
  months: SpyMonth[]
  invested: number
  spyValue: number
  portfolioUsd: number
  portfolioComplete: boolean
  skippedFx: number
  firstDate: string
}

export async function fetchSpyHistory(): Promise<SpyClose[]> {
  const { data, error } = await supabase.functions.invoke('quotes', {
    body: { history: 'SPY' },
  })
  if (error) throw new Error('No se pudo leer el histórico de SPY')
  const history = (data as { history?: SpyClose[] } | null)?.history ?? []
  return history.filter(
    (point) =>
      typeof point.date === 'string' &&
      typeof point.close === 'number' &&
      point.close > 0,
  )
}

function closeOnOrBefore(closes: SpyClose[], date: string): number | null {
  let lo = 0
  let hi = closes.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (closes[mid].date <= date) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found >= 0 ? closes[found].close : null
}

function toMonths(points: SpyPoint[], flows: { date: string; usd: number }[]): SpyMonth[] {
  const contributed = new Map<string, number>()
  for (const flow of flows) {
    const key = flow.date.slice(0, 7)
    contributed.set(key, (contributed.get(key) ?? 0) + flow.usd)
  }

  const months: SpyMonth[] = []
  for (const point of points) {
    const key = point.date.slice(0, 7)
    const last = months[months.length - 1]
    if (!last || last.month !== key) {
      months.push({
        month: key,
        contributed: contributed.get(key) ?? 0,
        invested: point.invested,
        spy: point.spy,
      })
      continue
    }
    last.invested = point.invested
    last.spy = point.spy
  }
  return months
}

export function portfolioUsdOf(
  assets: Asset[],
  positions: Map<string, PositionSummary>,
): { usd: number; complete: boolean } {
  let usd = 0
  let complete = true
  for (const asset of assets) {
    const position = positions.get(asset.id)
    if (!position || position.quantity <= 0) continue
    if (position.marketValueUsd == null) {
      complete = false
      continue
    }
    usd += position.marketValueUsd
  }
  return { usd, complete }
}

export function compareToSpy(input: {
  assets: Asset[]
  movements: Movement[]
  rateMap: Map<string, number>
  closes: SpyClose[]
  portfolioUsd: number
  portfolioComplete: boolean
}): SpyComparison | null {
  if (input.closes.length === 0) return null

  const assetsById = new Map(input.assets.map((asset) => [asset.id, asset]))
  const flows: { date: string; usd: number }[] = []
  let skippedFx = 0

  for (const movement of input.movements) {
    const asset = assetsById.get(movement.asset_id)
    if (!asset) continue
    const qty = Number(movement.quantity)
    const price = Number(movement.price_per_unit)
    const fees = Number(movement.fees)
    if (!(qty > 0) || !(price >= 0)) continue

    const native =
      movement.movement_type === 'buy' ? qty * price + fees : qty * price - fees
    const signed = movement.movement_type === 'buy' ? native : -native
    let usd: number | null = null
    if (asset.currency === 'USD') usd = signed
    else {
      const rate = input.rateMap.get(toRateDate(movement.traded_at))
      if (!rate || rate <= 0) {
        skippedFx += 1
        continue
      }
      usd = signed / rate
    }
    if (usd == null || !Number.isFinite(usd) || usd === 0) continue
    flows.push({ date: toRateDate(movement.traded_at), usd })
  }

  flows.sort((a, b) => a.date.localeCompare(b.date))
  if (flows.length === 0) return null

  const start = flows[0].date
  let shares = 0
  let invested = 0
  let flowIndex = 0
  const points: SpyPoint[] = []

  for (const bar of input.closes) {
    while (flowIndex < flows.length && flows[flowIndex].date <= bar.date) {
      const price = closeOnOrBefore(input.closes, flows[flowIndex].date) ?? bar.close
      if (price > 0) {
        shares += flows[flowIndex].usd / price
        invested += flows[flowIndex].usd
      }
      flowIndex += 1
    }
    if (bar.date < start) continue
    points.push({ date: bar.date, invested, spy: shares * bar.close })
  }

  const lastClose = input.closes[input.closes.length - 1].close
  while (flowIndex < flows.length) {
    if (lastClose > 0) {
      shares += flows[flowIndex].usd / lastClose
      invested += flows[flowIndex].usd
    }
    flowIndex += 1
  }

  const spyValue = shares * lastClose
  if (points.length === 0) {
    points.push({ date: start, invested, spy: spyValue })
  } else {
    points[points.length - 1] = {
      date: points[points.length - 1].date,
      invested,
      spy: spyValue,
    }
  }

  return {
    months: toMonths(points, flows),
    invested,
    spyValue,
    portfolioUsd: input.portfolioUsd,
    portfolioComplete: input.portfolioComplete,
    skippedFx,
    firstDate: start,
  }
}
