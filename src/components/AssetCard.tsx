import type { Asset, CurrencyCode, Movement, PositionSummary } from '../types'
import { ASSET_TYPE_LABELS } from '../types'
import { convertAmount, formatMoney, formatPct, formatQty, pnlClass } from '../lib/portfolio'

interface AssetCardProps {
  asset: Asset
  position: PositionSummary
  displayCurrency: CurrencyCode
  usdArsRate: number
  selected: boolean
  onSelect: () => void
}

export function AssetCard({
  asset,
  position,
  displayCurrency,
  usdArsRate,
  selected,
  onSelect,
}: AssetCardProps) {
  const hasPosition = position.quantity > 0
  const price = convertAmount(
    Number(asset.current_price),
    asset.currency,
    displayCurrency,
    usdArsRate,
  )
  const marketValue = convertAmount(
    position.marketValue,
    asset.currency,
    displayCurrency,
    usdArsRate,
  )
  const invested = convertAmount(position.costBasis, asset.currency, displayCurrency, usdArsRate)
  const pnl = convertAmount(position.unrealizedPnL, asset.currency, displayCurrency, usdArsRate)

  return (
    <button
      type="button"
      className={`asset-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="asset-card-top">
        <div>
          <strong>{asset.symbol}</strong>
          <span className="muted">{asset.name}</span>
        </div>
        <span className="chip">{ASSET_TYPE_LABELS[asset.asset_type]} · {asset.currency}</span>
      </div>

      <div className="asset-card-metrics">
        <div>
          <span className="label">Precio actual</span>
          <span>{formatMoney(price, displayCurrency)}</span>
        </div>
        <div>
          <span className="label">Cantidad</span>
          <span>{hasPosition ? formatQty(position.quantity) : '—'}</span>
        </div>
        <div>
          <span className="label">Valor de mercado</span>
          <span>{hasPosition ? formatMoney(marketValue, displayCurrency) : '—'}</span>
        </div>
        <div>
          <span className="label">Invertido</span>
          <span>{hasPosition ? formatMoney(invested, displayCurrency) : '—'}</span>
        </div>
        <div>
          <span className="label">P&L</span>
          <span className={hasPosition ? pnlClass(pnl) : ''}>
            {hasPosition
              ? `${formatMoney(pnl, displayCurrency)} (${formatPct(position.unrealizedPct)})`
              : 'Sin movimientos'}
          </span>
        </div>
      </div>
    </button>
  )
}

interface MovementListProps {
  movements: Movement[]
  currency: CurrencyCode
  onEdit: (movement: Movement) => void
  onDelete: (movement: Movement) => void
}

export function MovementList({ movements, currency, onEdit, onDelete }: MovementListProps) {
  if (movements.length === 0) {
    return <p className="empty">Todavía no hay compras ni ventas para este activo.</p>
  }

  return (
    <ul className="movement-list">
      {movements.map((movement) => (
        <li key={movement.id}>
          <div>
            <strong className={movement.movement_type === 'buy' ? 'buy' : 'sell'}>
              {movement.movement_type === 'buy' ? 'Compra' : 'Venta'}
            </strong>
            <span className="muted">
              {new Date(movement.traded_at).toLocaleString('es-AR')}
            </span>
          </div>
          <div className="movement-meta">
            <span>
              {formatQty(Number(movement.quantity))} @{' '}
              {formatMoney(Number(movement.price_per_unit), currency)}
            </span>
            <button type="button" className="btn ghost" onClick={() => onEdit(movement)}>
              Editar
            </button>
            <button type="button" className="btn ghost danger" onClick={() => onDelete(movement)}>
              Eliminar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
