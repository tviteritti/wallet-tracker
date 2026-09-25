import type { CurrencyCode, Movement, PositionSummary } from '../types'

export function toRateDate(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatRateDate(rateDate: string): string {
  const [year, month, day] = rateDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR')
}

export function pctOf(part: number, base: number): number {
  if (base === 0) return 0
  return (part / base) * 100
}

export function computePosition(
  movements: Movement[],
  currentPrice: number,
  assetCurrency: CurrencyCode,
  fxByDate: Map<string, number>,
  currentUsdArsRate: number,
): PositionSummary {
  const sorted = [...movements].sort(
    (a, b) =>
      new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime() ||
      a.created_at.localeCompare(b.created_at),
  )

  let quantity = 0
  let costBasis = 0
  let costBasisUsd = 0
  let realizedPnL = 0
  let realizedPnLUsd = 0
  let realizedCostBasis = 0
  let realizedCostBasisUsd = 0
  const missingFxDates = new Set<string>()
  let usdTrackComplete = true

  const toUsd = (amountNative: number, rateDate: string): number | null => {
    if (assetCurrency === 'USD') return amountNative
    const rate = fxByDate.get(rateDate)
    if (!rate || rate <= 0) {
      missingFxDates.add(rateDate)
      return null
    }
    return amountNative / rate
  }

  for (const movement of sorted) {
    const qty = Number(movement.quantity)
    const price = Number(movement.price_per_unit)
    const fees = Number(movement.fees)
    const rateDate = toRateDate(movement.traded_at)

    if (movement.movement_type === 'buy') {
      const cash = qty * price + fees
      const cashUsd = toUsd(cash, rateDate)
      if (cashUsd == null) usdTrackComplete = false
      else costBasisUsd += cashUsd
      costBasis += cash
      quantity += qty
      continue
    }

    if (quantity <= 0) continue

    const sellQty = Math.min(qty, quantity)
    const avgCost = costBasis / quantity
    const avgCostUsd = quantity > 0 ? costBasisUsd / quantity : 0
    const proceeds = sellQty * price - fees
    const proceedsUsd = toUsd(proceeds, rateDate)
    const soldCost = avgCost * sellQty
    const soldCostUsd = avgCostUsd * sellQty

    realizedPnL += proceeds - soldCost
    realizedCostBasis += soldCost
    if (proceedsUsd == null) usdTrackComplete = false
    else {
      realizedPnLUsd += proceedsUsd - soldCostUsd
      realizedCostBasisUsd += soldCostUsd
    }

    costBasis -= soldCost
    costBasisUsd -= soldCostUsd
    quantity -= sellQty
  }

  const marketValue = quantity * currentPrice
  const unrealizedPnL = marketValue - costBasis
  const unrealizedPct = pctOf(unrealizedPnL, costBasis)
  const totalPnL = unrealizedPnL + realizedPnL
  const avgCost = quantity > 0 ? costBasis / quantity : 0

  let marketValueUsd: number | null = null
  let unrealizedPnLUsd: number | null = null
  let totalPnLUsd: number | null = null
  let costBasisUsdOut: number | null = null
  let realizedPnLUsdOut: number | null = null
  let realizedCostBasisUsdOut: number | null = null

  if (assetCurrency === 'USD') {
    marketValueUsd = marketValue
    costBasisUsdOut = costBasisUsd
    unrealizedPnLUsd = unrealizedPnL
    realizedPnLUsdOut = realizedPnLUsd
    realizedCostBasisUsdOut = realizedCostBasisUsd
    totalPnLUsd = totalPnL
  } else if (usdTrackComplete && currentUsdArsRate > 0) {
    marketValueUsd = marketValue / currentUsdArsRate
    costBasisUsdOut = costBasisUsd
    unrealizedPnLUsd = marketValueUsd - costBasisUsd
    realizedPnLUsdOut = realizedPnLUsd
    realizedCostBasisUsdOut = realizedCostBasisUsd
    totalPnLUsd = (unrealizedPnLUsd ?? 0) + realizedPnLUsd
  }

  return {
    quantity,
    avgCost,
    costBasis,
    marketValue,
    unrealizedPnL,
    unrealizedPct,
    realizedPnL,
    realizedCostBasis,
    totalPnL,
    costBasisUsd: costBasisUsdOut,
    marketValueUsd,
    unrealizedPnLUsd,
    realizedPnLUsd: realizedPnLUsdOut,
    realizedCostBasisUsd: realizedCostBasisUsdOut,
    totalPnLUsd,
    missingFxDates: [...missingFxDates].sort(),
  }
}

/** Convierte un monto desde `from` hacia `to` usando 1 USD = usdArsRate ARS */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  usdArsRate: number,
): number {
  if (from === to) return amount
  if (usdArsRate <= 0) return amount
  if (from === 'USD' && to === 'ARS') return amount * usdArsRate
  return amount / usdArsRate
}

/**
 * Elige el monto a mostrar: para ARS→USD usa valuación histórica/actual en USD
 * cuando está disponible (costo/P&L con TC diario), no el TC de hoy sobre el costo.
 */
export function displayAmount(
  nativeAmount: number,
  usdAmount: number | null,
  assetCurrency: CurrencyCode,
  displayCurrency: CurrencyCode,
  currentUsdArsRate: number,
): number {
  if (assetCurrency === displayCurrency) return nativeAmount
  if (displayCurrency === 'USD' && usdAmount != null) return usdAmount
  return convertAmount(nativeAmount, assetCurrency, displayCurrency, currentUsdArsRate)
}

export function formatMoney(value: number, currency: CurrencyCode = 'USD'): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 6,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 8,
  }).format(value)
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function pnlClass(value: number): string {
  if (value > 0) return 'pnl-positive'
  if (value < 0) return 'pnl-negative'
  return 'pnl-flat'
}
