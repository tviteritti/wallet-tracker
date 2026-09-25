import type { Asset, CurrencyCode, Movement, PositionSummary } from '../types'
import { ASSET_TYPE_LABELS } from '../types'
import { formatMoney, formatPct, formatQty, pnlClass } from '../lib/portfolio'

interface AssetCardProps {
  asset: Asset
  position: PositionSummary
  selected: boolean
  onSelect: () => void
}

export function AssetCard({ asset, position, selected, onSelect }: AssetCardProps) {
  const hasPosition = position.quantity > 0

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
          <span>{formatMoney(Number(asset.current_price), asset.currency)}</span>
        </div>
        <div>
          <span className="label">Cantidad</span>
          <span>{hasPosition ? formatQty(position.quantity) : '—'}</span>
        </div>
        <div>
          <span className="label">P&L</span>
          <span className={hasPosition ? pnlClass(position.unrealizedPnL) : ''}>
            {hasPosition
              ? `${formatMoney(position.unrealizedPnL, asset.currency)} (${formatPct(position.unrealizedPct)})`
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
  onDelete: (id: string) => Promise<void>
}

export function MovementList({ movements, currency, onDelete }: MovementListProps) {
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
            <button
              type="button"
              className="btn ghost danger"
              onClick={() => void onDelete(movement.id)}
            >
              Eliminar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
