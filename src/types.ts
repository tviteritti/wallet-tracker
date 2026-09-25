export type AssetType = 'crypto' | 'stock' | 'cedear' | 'bond' | 'etf' | 'fiat' | 'other'
export type MovementType = 'buy' | 'sell'
export type CurrencyCode = 'USD' | 'ARS'

export interface Asset {
  id: string
  name: string
  symbol: string
  asset_type: AssetType
  currency: CurrencyCode
  current_price: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Movement {
  id: string
  asset_id: string
  movement_type: MovementType
  quantity: number
  price_per_unit: number
  fees: number
  traded_at: string
  notes: string | null
  created_at: string
}

export interface AssetFormData {
  name: string
  symbol: string
  asset_type: AssetType
  currency: CurrencyCode
  current_price: number
  notes: string
}

export interface MovementFormData {
  movement_type: MovementType
  quantity: number
  price_per_unit: number
  fees: number
  traded_at: string
  notes: string
}

export interface PositionSummary {
  quantity: number
  avgCost: number
  costBasis: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPct: number
}

export interface AppSettings {
  id: number
  usd_ars_rate: number
  updated_at: string
}

export const CURRENCIES: CurrencyCode[] = ['USD', 'ARS']

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: 'USD — Dólar',
  ARS: 'ARS — Peso argentino',
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  crypto: 'Cripto',
  stock: 'Acción',
  cedear: 'CEDEAR',
  bond: 'Bono',
  etf: 'ETF',
  fiat: 'Fiat',
  other: 'Otro',
}
