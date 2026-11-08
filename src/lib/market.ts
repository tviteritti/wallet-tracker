import type { Asset, AssetGroup } from '../types'
import { supabase } from './supabase'

export type QuoteSource = 'Binance' | 'Yahoo' | 'CCL' | 'Bonos' | 'MEP' | 'Cripto'

export interface DollarRates {
  mep: number
  ccl: number
  oficial: number
  cripto: number | null
}

export interface QuoteBasis {
  underlying: string
  underlyingUsd: number
  ratio: number
  ccl: number | null
}

export interface QuotedPrice {
  price: number
  source: QuoteSource
  basis?: QuoteBasis
}

export function quoteTag(quote: QuotedPrice | undefined): string {
  if (!quote) return 'Manual'
  if (quote.source === 'Binance') return 'API · Binance'
  if (quote.source === 'Yahoo') return 'API · Yahoo'
  if (quote.source === 'Bonos') return 'API · Bonos'
  if (quote.source === 'MEP') return 'API · MEP'
  if (quote.source === 'Cripto') return 'API · Cripto'
  if (quote.source === 'CCL' && !quote.basis) return 'API · CCL'
  return quote.basis?.ccl ? 'API · CCL' : 'API · ratio'
}

export function quoteShort(quote: QuotedPrice | undefined): string {
  if (!quote) return 'Manual'
  if (quote.source === 'Binance') return 'Binance'
  if (quote.source === 'Yahoo') return 'Yahoo'
  if (quote.source === 'Bonos') return 'Bonos'
  if (quote.source === 'MEP') return 'MEP'
  if (quote.source === 'Cripto') return 'Cripto'
  if (quote.source === 'CCL' && !quote.basis) return 'CCL'
  return quote.basis?.ccl ? 'CCL' : 'Ratio'
}

export function quoteBasisText(quote: QuotedPrice | undefined): string | null {
  const basis = quote?.basis
  if (!basis) return null
  const usd = basis.underlyingUsd.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const ratio = basis.ratio.toLocaleString('es-AR', { maximumFractionDigits: 4 })
  if (basis.ccl) {
    const ccl = basis.ccl.toLocaleString('es-AR', { maximumFractionDigits: 2 })
    return `${basis.underlying} US$ ${usd} × CCL ${ccl} / ${ratio}`
  }
  return `${basis.underlying} US$ ${usd} / ${ratio}`
}

export interface MarketSnapshot {
  prices: Record<string, QuotedPrice>
  btcUsd: number | null
  fx: DollarRates | null
  error: string | null
}

const STABLES = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'USD'])
const SYMBOL = /^[A-Z0-9.]{1,15}$/

interface DolarRow {
  casa?: string
  venta?: number
}

interface YahooResponse {
  prices?: Record<string, number>
}

interface BondRow {
  ticker?: string
  moneda?: string
  tcType?: string
  precio?: number
}

export function roundPrice(value: number): number {
  return Math.round(value * 1e8) / 1e8
}

export function roundRate(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

export function sameAmount(left: number, right: number): boolean {
  const scale = Math.max(Math.abs(left), Math.abs(right), 1)
  return Math.abs(left - right) <= scale * 1e-6
}

export function binancePair(asset: Asset): string | null {
  if (asset.asset_type !== 'crypto') return null
  const symbol = asset.symbol.trim().toUpperCase()
  if (!symbol || STABLES.has(symbol)) return null
  const base = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol
  if (!/^[A-Z0-9]{2,15}$/.test(base)) return null
  return `${base}USDT`
}

export function yahooSymbol(asset: Asset): string | null {
  if (asset.asset_type !== 'stock' && asset.asset_type !== 'etf' && asset.asset_type !== 'cedear') {
    return null
  }
  const symbol = asset.symbol.trim().toUpperCase()
  if (!symbol) return null
  if (symbol.endsWith('.BA')) return symbol
  if (asset.asset_type === 'cedear' || asset.venue != null || asset.currency === 'ARS') {
    return `${symbol}.BA`
  }
  return symbol
}

export function cedearRatioOf(asset: Asset, group?: AssetGroup): number | null {
  const own = Number(asset.cedear_ratio)
  if (own > 0) return own
  if (group && Number(group.cedear_ratio) > 0) return Number(group.cedear_ratio)
  return null
}

export function underlyingTicker(asset: Asset, group?: AssetGroup): string | null {
  if (asset.asset_type !== 'cedear' || !cedearRatioOf(asset, group)) return null
  if (group?.kind === 'ibit') return 'IBIT'
  let symbol = asset.symbol.trim().toUpperCase()
  if (symbol.endsWith('.BA')) symbol = symbol.slice(0, -3)
  if (asset.venue === 'mep' && symbol.endsWith('D') && symbol.length > 1) symbol = symbol.slice(0, -1)
  if (asset.venue === 'ccl' && symbol.endsWith('C') && symbol.length > 1) symbol = symbol.slice(0, -1)
  return SYMBOL.test(symbol) ? symbol : null
}

function cryptoUsd(asset: Asset, pairs: Record<string, number>): number | null {
  const symbol = asset.symbol.trim().toUpperCase()
  if (STABLES.has(symbol)) return 1
  const pair = binancePair(asset)
  if (!pair) return null
  return pairs[pair] ?? null
}

function cedearQuote(
  asset: Asset,
  group: AssetGroup | undefined,
  yahoo: Record<string, number>,
  fx: DollarRates | null,
): QuotedPrice | null {
  const ratio = cedearRatioOf(asset, group)
  const underlying = underlyingTicker(asset, group)
  if (!ratio || !underlying) return null
  const underlyingUsd = yahoo[underlying]
  if (!(underlyingUsd > 0)) return null
  const inPesos = asset.currency === 'ARS' || asset.venue === 'ars'
  if (inPesos) {
    if (!fx) return null
    return {
      price: roundPrice((underlyingUsd * fx.ccl) / ratio),
      source: 'CCL',
      basis: { underlying, underlyingUsd, ratio, ccl: fx.ccl },
    }
  }
  return {
    price: roundPrice(underlyingUsd / ratio),
    source: 'CCL',
    basis: { underlying, underlyingUsd, ratio, ccl: null },
  }
}

function bondQuote(
  asset: Asset,
  bonds: Record<string, BondRow>,
  fx: DollarRates | null,
): QuotedPrice | null {
  const bond = bonds[asset.symbol.trim().toUpperCase()]
  const px = bond?.precio
  if (px == null || !(px > 0)) return null
  // La cotización de BYMA es por cada 100 de valor nominal. La cantidad del portfolio es de a 1.
  const unit = px / 100
  const inUsd = (bond?.moneda ?? 'USD').toUpperCase() !== 'ARS'
  if (asset.currency === 'USD') {
    if (!inUsd) {
      if (!fx) return null
      return { price: roundPrice(unit / fx.mep), source: 'Bonos' }
    }
    return { price: roundPrice(unit), source: 'Bonos' }
  }
  if (!inUsd) return { price: roundPrice(unit), source: 'Bonos' }
  const rate = bond?.tcType === 'CCL' ? fx?.ccl : fx?.mep
  if (!rate) return null
  return { price: roundPrice(unit * rate), source: 'Bonos' }
}

function quoteAsset(
  asset: Asset,
  group: AssetGroup | undefined,
  pairs: Record<string, number>,
  yahoo: Record<string, number>,
  bonds: Record<string, BondRow>,
  fx: DollarRates | null,
): QuotedPrice | null {
  if (asset.asset_type === 'crypto') {
    const usd = cryptoUsd(asset, pairs)
    if (usd == null) return null
    if (asset.currency === 'ARS') {
      if (!fx) return null
      return { price: roundPrice(usd * fx.mep), source: 'Binance' }
    }
    return { price: roundPrice(usd), source: 'Binance' }
  }

  const calculated = cedearQuote(asset, group, yahoo, fx)
  if (calculated) return calculated

  const cash = fiatQuote(asset, fx)
  if (cash) return cash

  if (asset.asset_type === 'bond' || asset.asset_type === 'other') {
    return bondQuote(asset, bonds, fx)
  }

  const symbol = yahooSymbol(asset)
  if (!symbol) return null
  const price = yahoo[symbol]
  if (price == null) return null
  return { price: roundPrice(price), source: 'Yahoo' }
}

async function fetchFx(): Promise<DollarRates> {
  const response = await fetch('https://dolarapi.com/v1/dolares')
  if (!response.ok) throw new Error('No se pudo leer el dólar')
  const rows = (await response.json()) as DolarRow[]
  const venta = (casa: string) => {
    const value = rows.find((row) => row.casa === casa)?.venta
    return typeof value === 'number' && value > 0 ? roundRate(value) : null
  }
  const mep = venta('bolsa')
  const ccl = venta('contadoconliqui')
  const oficial = venta('oficial')
  if (mep == null || ccl == null || oficial == null) throw new Error('Dolarapi no trajo MEP o CCL')
  return { mep, ccl, oficial, cripto: venta('cripto') }
}

function fiatQuote(asset: Asset, fx: DollarRates | null): QuotedPrice | null {
  if (!fx) return null
  const symbol = asset.symbol.trim().toUpperCase()
  if (symbol === 'USDX') {
    const cripto = fx.cripto
    const rate = cripto ?? fx.ccl
    const source: QuoteSource = cripto ? 'Cripto' : 'CCL'
    if (asset.currency === 'ARS') return { price: roundPrice(rate), source }
    return { price: roundPrice(rate / fx.mep), source }
  }
  if (asset.asset_type !== 'fiat') return null
  if (asset.currency === 'ARS' || symbol === 'ARS') return { price: 1, source: 'MEP' }
  if (asset.currency === 'USD' || symbol === 'USD') return { price: 1, source: 'MEP' }
  return null
}

async function fetchBinance(pairs: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  await Promise.all(
    pairs.map(async (pair) => {
      const response = await fetch(
        `https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`,
      )
      if (!response.ok) return
      const body = (await response.json()) as { price?: string }
      const price = Number(body.price)
      if (Number.isFinite(price) && price > 0) prices[pair] = price
    }),
  )
  return prices
}

async function fetchYahoo(symbols: string[]): Promise<Record<string, number>> {
  const allowed = symbols.filter((symbol) => SYMBOL.test(symbol))
  if (allowed.length === 0) return {}
  const { data, error } = await supabase.functions.invoke('quotes', {
    body: { symbols: allowed },
  })
  if (error) throw new Error('No se pudieron leer acciones ni CEDEARs')
  const prices = (data as YahooResponse | null)?.prices ?? {}
  const parsed: Record<string, number> = {}
  for (const [symbol, price] of Object.entries(prices)) {
    if (typeof price === 'number' && price > 0) parsed[symbol] = price
  }
  return parsed
}

async function fetchBonds(): Promise<Record<string, BondRow>> {
  const response = await fetch('https://compararfondos.com.ar/api/bonos')
  if (!response.ok) throw new Error('No se pudieron leer bonos y ON')
  const body = (await response.json()) as { bonds?: BondRow[] }
  const bonds: Record<string, BondRow> = {}
  for (const bond of body.bonds ?? []) {
    const ticker = bond.ticker?.trim().toUpperCase()
    if (ticker && typeof bond.precio === 'number' && bond.precio > 0) bonds[ticker] = bond
  }
  return bonds
}

export async function fetchMarket(assets: Asset[], groups: AssetGroup[] = []): Promise<MarketSnapshot> {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const needsBonds = assets.some(
    (asset) => asset.asset_type === 'bond' || asset.asset_type === 'other',
  )
  const pairs = new Set<string>(['BTCUSDT'])
  const yahooSymbols = new Set<string>()
  for (const asset of assets) {
    const group = asset.group_id ? groupById.get(asset.group_id) : undefined
    const pair = binancePair(asset)
    if (pair) pairs.add(pair)
    const underlying = underlyingTicker(asset, group)
    if (underlying) yahooSymbols.add(underlying)
    const symbol = yahooSymbol(asset)
    if (symbol) yahooSymbols.add(symbol)
  }

  const [fxResult, cryptoResult, yahooResult, bondResult] = await Promise.allSettled([
    fetchFx(),
    fetchBinance([...pairs]),
    yahooSymbols.size > 0 ? fetchYahoo([...yahooSymbols]) : Promise.resolve({}),
    needsBonds ? fetchBonds() : Promise.resolve({}),
  ])

  const errors: string[] = []
  const fx = fxResult.status === 'fulfilled' ? fxResult.value : null
  const crypto = cryptoResult.status === 'fulfilled' ? cryptoResult.value : {}
  const yahoo = yahooResult.status === 'fulfilled' ? yahooResult.value : {}
  const bonds = bondResult.status === 'fulfilled' ? bondResult.value : {}

  if (fxResult.status === 'rejected') errors.push('el dólar')
  if (cryptoResult.status === 'rejected') errors.push('las criptos')
  if (yahooResult.status === 'rejected') errors.push('acciones y CEDEARs')
  else if (yahooSymbols.size > 0 && Object.keys(yahoo).length === 0) {
    errors.push('acciones y CEDEARs')
  }
  if (bondResult.status === 'rejected') errors.push('bonos y ON')

  const prices: Record<string, QuotedPrice> = {}
  for (const asset of assets) {
    const group = asset.group_id ? groupById.get(asset.group_id) : undefined
    const quote = quoteAsset(asset, group, crypto, yahoo, bonds, fx)
    if (quote) prices[asset.id] = quote
  }

  return {
    prices,
    btcUsd: crypto.BTCUSDT != null ? roundPrice(crypto.BTCUSDT) : null,
    fx,
    error: errors.length > 0 ? `No se actualizó: ${errors.join(', ')}.` : null,
  }
}
