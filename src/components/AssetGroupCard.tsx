import { VENUE_SHORT } from '../lib/ibit'
import { useAmounts } from '../lib/privacy'
import { quoteShort, type QuotedPrice } from '../lib/market'
import {
  displayAmount,
  formatMoney,
  formatPct,
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
  quotes: Record<string, QuotedPrice>
  onSelect: () => void
}

export function AssetGroupCard({
  group,
  legs,
  positions,
  displayCurrency,
  usdArsRate,
  quotes = {},
  onSelect,
}: AssetGroupCardProps) {
  const { money, qty } = useAmounts()
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
        <span className="chip-row">
          <span className="chip">CEDEAR · {legs.length} plazas</span>
          <span className={`chip ${legs.some((leg) => quotes[leg.id]) ? 'chip-live' : 'chip-manual'}`}>
            {legs.every((leg) => quotes[leg.id])
              ? 'API'
              : legs.some((leg) => quotes[leg.id])
                ? 'API · parcial'
                : 'Manual'}
          </span>
        </span>
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
              <span className="group-leg-name">
                <span>
                  {leg.venue ? VENUE_SHORT[leg.venue] : leg.symbol} · {leg.symbol}
                </span>
                <span className={`chip ${quotes[leg.id] ? 'chip-live' : 'chip-manual'}`}>
                  {quoteShort(quotes[leg.id])}
                </span>
              </span>
              <span>{price > 0 ? formatMoney(price, leg.currency) : 'Sin precio'}</span>
              <span>{hasPosition ? qty(position!.quantity) : '—'}</span>
              <span className={hasPosition ? pnlClass(pnl) : 'muted'}>
                {hasPosition ? money(pnl, displayCurrency) : '—'}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="asset-card-metrics">
        <div>
          <span className="label">CEDEARs totales</span>
          <span>{quantity > 0 ? qty(quantity) : '—'}</span>
        </div>
        <div>
          <span className="label">Valor combinado</span>
          <span>{quantity > 0 ? money(market, displayCurrency) : '—'}</span>
        </div>
        <div>
          <span className="label">P&L total</span>
          <span className={quantity > 0 ? pnlClass(total) : ''}>
            {quantity > 0
              ? `${money(total, displayCurrency)} (${formatPct(pctOf(total, invested))})`
              : '—'}
          </span>
        </div>
      </div>
    </button>
  )
}
