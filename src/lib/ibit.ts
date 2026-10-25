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

export interface UsdCheck {
  marketPrice: number
  fairUsd: number
  impliedBtc: number | null
  gapPct: number | null
}

export interface PesoCheck {
  rate: number
  fairArs: number
  usdPrice: number | null
  impliedBtc: number | null
  gapPct: number | null
  versusUsdVenuePct: number | null
}

export interface IbitQuote {
  etfUsd: number
  cedearUsd: number
  mep: UsdCheck
  ccl: UsdCheck
  pesoPrice: number
  viaMep: PesoCheck | null
  viaCcl: PesoCheck | null
}

function gapPct(market: number, theoretical: number): number | null {
  if (market <= 0 || theoretical <= 0) return null
  return ((market - theoretical) / theoretical) * 100
}

function usdCheck(marketPrice: number, fairUsd: number, btcPerShare: number, cedearRatio: number): UsdCheck {
  const impliedBtc = marketPrice > 0 ? (marketPrice * cedearRatio) / btcPerShare : null
  return {
    marketPrice,
    fairUsd,
    impliedBtc,
    gapPct: gapPct(marketPrice, fairUsd),
  }
}

function pesoCheck(
  pesoPrice: number,
  rate: number,
  fairUsd: number,
  usdVenuePrice: number,
  btcPerShare: number,
  cedearRatio: number,
): PesoCheck | null {
  if (!(rate > 0)) return null
  const fairArs = fairUsd * rate
  const usdPrice = pesoPrice > 0 ? pesoPrice / rate : null
  const impliedBtc = usdPrice != null ? (usdPrice * cedearRatio) / btcPerShare : null
  const viaVenue = usdVenuePrice > 0 ? usdVenuePrice * rate : 0
  return {
    rate,
    fairArs,
    usdPrice,
    impliedBtc,
    gapPct: gapPct(pesoPrice, fairArs),
    versusUsdVenuePct: gapPct(pesoPrice, viaVenue),
  }
}

export function buildIbitQuote(input: {
  btcUsd: number
  btcPerShare: number
  cedearRatio: number
  mepRate: number
  cclRate: number
  prices: Partial<Record<QuoteVenue, number>>
}): IbitQuote | null {
  const { btcUsd, btcPerShare, cedearRatio, mepRate, cclRate, prices } = input
  if (!(btcUsd > 0) || !(btcPerShare > 0) || !(cedearRatio > 0)) return null

  const etfUsd = btcUsd * btcPerShare
  const cedearUsd = etfUsd / cedearRatio
  const pesoPrice = prices.ars ?? 0
  const mepPrice = prices.mep ?? 0
  const cclPrice = prices.ccl ?? 0

  return {
    etfUsd,
    cedearUsd,
    mep: usdCheck(mepPrice, cedearUsd, btcPerShare, cedearRatio),
    ccl: usdCheck(cclPrice, cedearUsd, btcPerShare, cedearRatio),
    pesoPrice,
    viaMep: pesoCheck(pesoPrice, mepRate, cedearUsd, mepPrice, btcPerShare, cedearRatio),
    viaCcl: pesoCheck(pesoPrice, cclRate, cedearUsd, cclPrice, btcPerShare, cedearRatio),
  }
}

export function pricesFromLegs(legs: Asset[]): Partial<Record<QuoteVenue, number>> {
  const prices: Partial<Record<QuoteVenue, number>> = {}
  for (const leg of legs) {
    if (leg.venue) prices[leg.venue] = Number(leg.current_price)
  }
  return prices
}
