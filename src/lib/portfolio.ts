import type { CurrencyCode, Movement, PositionSummary } from '../types'

export function computePosition(
  movements: Movement[],
  currentPrice: number,
): PositionSummary {
  const sorted = [...movements].sort(
    (a, b) =>
      new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime() ||
      a.created_at.localeCompare(b.created_at),
  )

  let quantity = 0
  let costBasis = 0

  for (const movement of sorted) {
    if (movement.movement_type === 'buy') {
      costBasis += movement.quantity * movement.price_per_unit + Number(movement.fees)
      quantity += Number(movement.quantity)
      continue
    }

    if (quantity <= 0) continue

    const sellQty = Math.min(Number(movement.quantity), quantity)
    const avgCost = costBasis / quantity
    costBasis -= avgCost * sellQty
    quantity -= sellQty
  }

  const marketValue = quantity * currentPrice
  const unrealizedPnL = marketValue - costBasis
  const unrealizedPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0
  const avgCost = quantity > 0 ? costBasis / quantity : 0

  return {
    quantity,
    avgCost,
    costBasis,
    marketValue,
    unrealizedPnL,
    unrealizedPct,
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
