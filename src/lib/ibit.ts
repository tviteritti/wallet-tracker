import type { Asset, QuoteVenue } from '../types'

export const VENUE_ORDER: Record<QuoteVenue, number> = { ars: 0, mep: 1, ccl: 2 }

export const VENUE_LABELS: Record<QuoteVenue, string> = {
  ars: 'Pesos',
  mep: 'Dólar MEP',
  ccl: 'Dólar CCL',
}

export const VENUE_SHORT: Record<QuoteVenue, string> = {
  ars: 'Pesos',
  mep: 'MEP',
  ccl: 'CCL',
}

export function sortByVenue<T extends { venue: QuoteVenue | null }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (VENUE_ORDER[a.venue ?? 'ars'] ?? 9) - (VENUE_ORDER[b.venue ?? 'ars'] ?? 9),
  )
}

export function isQuoteVenue(value: string | null | undefined): value is QuoteVenue {
  return value === 'ars' || value === 'mep' || value === 'ccl'
}

export interface IbitLegQuote {
  venue: QuoteVenue
  marketPrice: number
  theoretical: number
  impliedBtc: number | null
  gapPct: number | null
}

export interface IbitQuote {
  btcPerCedear: number
  etfUsd: number
  cedearUsd: number
  cedearArs: number
  legs: IbitLegQuote[]
  impliedMep: number | null
  impliedCcl: number | null
}

function gapPct(market: number, theoretical: number): number | null {
  if (market <= 0 || theoretical <= 0) return null
  return ((market - theoretical) / theoretical) * 100
}

export function buildIbitQuote(input: {
  btcUsd: number
  btcPerShare: number
  cedearRatio: number
  usdArsRate: number
  prices: Partial<Record<QuoteVenue, number>>
}): IbitQuote | null {
  const { btcUsd, btcPerShare, cedearRatio, usdArsRate, prices } = input
  if (!(btcUsd > 0) || !(btcPerShare > 0) || !(cedearRatio > 0)) return null

  const etfUsd = btcUsd * btcPerShare
  const cedearUsd = etfUsd / cedearRatio
  const cedearArs = usdArsRate > 0 ? cedearUsd * usdArsRate : 0
  const btcPerCedear = btcPerShare / cedearRatio

  const venues: QuoteVenue[] = ['ars', 'mep', 'ccl']
  const legs = venues.map((venue) => {
    const marketPrice = Number(prices[venue] ?? 0)
    const theoretical = venue === 'ars' ? cedearArs : cedearUsd
    let impliedBtc: number | null = null
    if (marketPrice > 0) {
      if (venue === 'ars') {
        impliedBtc = usdArsRate > 0 ? (marketPrice / usdArsRate) * cedearRatio / btcPerShare : null
      } else {
        impliedBtc = (marketPrice * cedearRatio) / btcPerShare
      }
    }
    return {
      venue,
      marketPrice,
      theoretical,
      impliedBtc,
      gapPct: gapPct(marketPrice, theoretical),
    }
  })

  const ars = prices.ars ?? 0
  const mep = prices.mep ?? 0
  const ccl = prices.ccl ?? 0

  return {
    btcPerCedear,
    etfUsd,
    cedearUsd,
    cedearArs,
    legs,
    impliedMep: ars > 0 && mep > 0 ? ars / mep : null,
    impliedCcl: ars > 0 && ccl > 0 ? ars / ccl : null,
  }
}

export function pricesFromLegs(legs: Asset[]): Partial<Record<QuoteVenue, number>> {
  const prices: Partial<Record<QuoteVenue, number>> = {}
  for (const leg of legs) {
    if (leg.venue) prices[leg.venue] = Number(leg.current_price)
  }
  return prices
}
