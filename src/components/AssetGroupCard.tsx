import { VENUE_SHORT } from '../lib/ibit'
import {
  displayAmount,
  formatMoney,
  formatPct,
  formatQty,
  pctOf,
  pnlClass,
} from '../lib/portfolio'
import type { Asset, AssetGroup, CurrencyCode, PositionSummary } from '../types'

interface AssetGroupCardProps {
  group: AssetGroup
  legs: Asset[]
  positions: Map<string, PositionSummary>
  displayCurrency: CurrencyCode
  usdArsRate: number
  onSelect: () => void
}

export function AssetGroupCard({
  group,
  legs,
  positions,
  displayCurrency,
  usdArsRate,
  onSelect,
}: AssetGroupCardProps) {
  let market = 0
  let invested = 0
  let total = 0
  let quantity = 0

  for (const leg of legs) {
    const position = positions.get(leg.id)
    if (!position) continue
    quantity += position.quantity
    market += displayAmount(
      position.marketValue,
      position.marketValueUsd,
      leg.currency,
      displayCurrency,
      usdArsRate,
    )
    invested += displayAmount(
      position.costBasis,
      position.costBasisUsd,
      leg.currency,
      displayCurrency,
      usdArsRate,
    )
    total += displayAmount(
      position.totalPnL,
      position.totalPnLUsd,
      leg.currency,
      displayCurrency,
      usdArsRate,
    )
  }

  return (
    <button type="button" className="asset-card" onClick={onSelect}>
      <div className="asset-card-top">
        <div>
          <strong>{group.name}</strong>
          <span className="muted">CEDEAR iShares Bitcoin Trust</span>
        </div>
        <span className="chip">CEDEAR · {legs.length} plazas</span>
      </div>

      <ul className="group-legs">
        {legs.map((leg) => {
          const position = positions.get(leg.id)
          const price = Number(leg.current_price)
          const pnl = position
            ? displayAmount(
                position.totalPnL,
                position.totalPnLUsd,
                leg.currency,
                displayCurrency,
                usdArsRate,
              )
            : 0
          const hasPosition = (position?.quantity ?? 0) > 0
          return (
            <li key={leg.id}>
              <span>
                {leg.venue ? VENUE_SHORT[leg.venue] : leg.symbol} · {leg.symbol}
              </span>
              <span>{price > 0 ? formatMoney(price, leg.currency) : 'Sin precio'}</span>
              <span>{hasPosition ? formatQty(position!.quantity) : '—'}</span>
              <span className={hasPosition ? pnlClass(pnl) : 'muted'}>
                {hasPosition ? formatMoney(pnl, displayCurrency) : '—'}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="asset-card-metrics">
        <div>
          <span className="label">CEDEARs totales</span>
          <span>{quantity > 0 ? formatQty(quantity) : '—'}</span>
        </div>
        <div>
          <span className="label">Valor combinado</span>
          <span>{quantity > 0 ? formatMoney(market, displayCurrency) : '—'}</span>
        </div>
        <div>
          <span className="label">P&L total</span>
          <span className={quantity > 0 ? pnlClass(total) : ''}>
            {quantity > 0
              ? `${formatMoney(total, displayCurrency)} (${formatPct(pctOf(total, invested))})`
              : '—'}
          </span>
        </div>
      </div>
    </button>
  )
}
