import { useState } from 'react'
import { IbitCalculator } from './IbitCalculator'
import { MovementList } from './AssetCard'
import { MovementForm } from './MovementForm'
import { VENUE_LABELS, VENUE_SHORT, isQuoteVenue, pricesFromLegs } from '../lib/ibit'
import {
  displayAmount,
  formatMoney,
  formatPct,
  formatQty,
  pctOf,
  pnlClass,
} from '../lib/portfolio'
import type {
  Asset,
  AssetGroup,
  CurrencyCode,
  Movement,
  MovementFormData,
  PositionSummary,
  QuoteVenue,
} from '../types'

interface IbitGroupDetailProps {
  group: AssetGroup
  legs: Asset[]
  positions: Map<string, PositionSummary>
  movements: Movement[]
  displayCurrency: CurrencyCode
  usdArsRate: number
  referenceBtcPrice: number
  busy: boolean
  run: (action: () => Promise<void>, fallback: string) => Promise<void>
  onUpdateAsset: (id: string, data: { current_price: number }) => Promise<void>
  onCreateMovement: (assetId: string, data: MovementFormData) => Promise<void>
  onUpdateMovement: (id: string, data: MovementFormData) => Promise<void>
  onDeleteMovement: (movement: Movement) => void
  onDeleteGroup: () => void
}

const PRICE_LABEL: Record<QuoteVenue, string> = {
  ars: 'Precio actual (manual, pesos)',
  mep: 'Precio actual (manual, USD MEP)',
  ccl: 'Precio actual (manual, USD CCL)',
}

export function IbitGroupDetail({
  group,
  legs,
  positions,
  movements,
  displayCurrency,
  usdArsRate,
  referenceBtcPrice,
  busy,
  run,
  onUpdateAsset,
  onCreateMovement,
  onUpdateMovement,
  onDeleteMovement,
  onDeleteGroup,
}: IbitGroupDetailProps) {
  const [venue, setVenue] = useState<QuoteVenue>('ars')
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)

  const leg = legs.find((item) => item.venue === venue) ?? legs[0] ?? null
  const position = leg ? positions.get(leg.id) : null
  const legMovements = leg ? movements.filter((item) => item.asset_id === leg.id) : []

  let quantity = 0
  let market = 0
  let invested = 0
  let unrealized = 0
  let total = 0
  for (const item of legs) {
    const itemPosition = positions.get(item.id)
    if (!itemPosition) continue
    quantity += itemPosition.quantity
    market += displayAmount(itemPosition.marketValue, itemPosition.marketValueUsd, item.currency, displayCurrency, usdArsRate)
    invested += displayAmount(itemPosition.costBasis, itemPosition.costBasisUsd, item.currency, displayCurrency, usdArsRate)
    unrealized += displayAmount(itemPosition.unrealizedPnL, itemPosition.unrealizedPnLUsd, item.currency, displayCurrency, usdArsRate)
    total += displayAmount(itemPosition.totalPnL, itemPosition.totalPnLUsd, item.currency, displayCurrency, usdArsRate)
  }

  function showAmount(native: number, usd: number | null, currency: CurrencyCode) {
    return formatMoney(displayAmount(native, usd, currency, displayCurrency, usdArsRate), displayCurrency)
  }

  return (
    <>
      <div className="panel">
        <div className="detail-header">
          <div>
            <h2>
              {group.name} <span className="muted">· CEDEAR iShares Bitcoin Trust</span>
            </h2>
            <p className="muted">
              Mismo certificado en tres plazas. Cada una tiene su precio, sus compras y su P&L.
            </p>
          </div>
          <div className="detail-actions">
            <button type="button" className="btn ghost danger" onClick={onDeleteGroup}>
              Eliminar
            </button>
          </div>
        </div>

        <div className="detail-metrics">
          <div>
            <span className="label">CEDEARs totales</span>
            <strong>{formatQty(quantity)}</strong>
          </div>
          <div>
            <span className="label">Valor combinado</span>
            <strong>{formatMoney(market, displayCurrency)}</strong>
          </div>
          <div>
            <span className="label">P&L no realizado</span>
            <strong className={pnlClass(unrealized)}>
              {formatMoney(unrealized, displayCurrency)} ({formatPct(pctOf(unrealized, invested))})
            </strong>
          </div>
          <div>
            <span className="label">P&L total</span>
            <strong className={pnlClass(total)}>
              {formatMoney(total, displayCurrency)} ({formatPct(pctOf(total, invested))})
            </strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <IbitCalculator
          btcPerShare={Number(group.btc_per_share)}
          cedearRatio={Number(group.cedear_ratio)}
          referenceBtcPrice={referenceBtcPrice}
          prices={pricesFromLegs(legs)}
          busy={busy}
          onApplyPrice={(nextVenue, price) => {
            const target = legs.find((item) => item.venue === nextVenue)
            if (!target) return Promise.resolve()
            return run(
              () => onUpdateAsset(target.id, { current_price: price }),
              'No se pudo actualizar el precio',
            )
          }}
        />
      </div>

      <div className="panel">
        <div className="venue-tabs" role="tablist" aria-label="Plazas de IBIT">
          {legs.map((item) =>
            isQuoteVenue(item.venue) ? (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.venue === leg?.venue}
                className={`btn ${item.venue === leg?.venue ? 'primary' : 'ghost'}`}
                onClick={() => {
                  setVenue(item.venue as QuoteVenue)
                  setEditingPrice(false)
                  setEditingMovement(null)
                }}
              >
                {VENUE_SHORT[item.venue]} · {item.symbol}
              </button>
            ) : null,
          )}
        </div>

        {leg && position ? (
          <>
            <h3>
              {isQuoteVenue(leg.venue) ? VENUE_LABELS[leg.venue] : leg.symbol}
              <span className="muted"> · {leg.symbol}</span>
            </h3>
            <p className="muted">Los movimientos de esta plaza no se suman a las otras.</p>

            <div className="detail-metrics">
              <div>
                <span className="label">Cantidad</span>
                <strong>{formatQty(position.quantity)}</strong>
              </div>
              <div>
                <span className="label">Valor de mercado</span>
                <strong>{showAmount(position.marketValue, position.marketValueUsd, leg.currency)}</strong>
              </div>
              <div>
                <span className="label">Costo</span>
                <strong>{showAmount(position.costBasis, position.costBasisUsd, leg.currency)}</strong>
              </div>
              <div>
                <span className="label">P&L no realizado</span>
                <strong className={pnlClass(displayAmount(position.unrealizedPnL, position.unrealizedPnLUsd, leg.currency, displayCurrency, usdArsRate))}>
                  {showAmount(position.unrealizedPnL, position.unrealizedPnLUsd, leg.currency)} (
                  {formatPct(
                    pctOf(
                      displayAmount(position.unrealizedPnL, position.unrealizedPnLUsd, leg.currency, displayCurrency, usdArsRate),
                      displayAmount(position.costBasis, position.costBasisUsd, leg.currency, displayCurrency, usdArsRate),
                    ),
                  )}
                  )
                </strong>
              </div>
              <div>
                <span className="label">P&L realizado</span>
                <strong className={pnlClass(displayAmount(position.realizedPnL, position.realizedPnLUsd, leg.currency, displayCurrency, usdArsRate))}>
                  {showAmount(position.realizedPnL, position.realizedPnLUsd, leg.currency)} (
                  {formatPct(
                    pctOf(
                      displayAmount(position.realizedPnL, position.realizedPnLUsd, leg.currency, displayCurrency, usdArsRate),
                      displayAmount(position.realizedCostBasis, position.realizedCostBasisUsd, leg.currency, displayCurrency, usdArsRate),
                    ),
                  )}
                  )
                </strong>
              </div>
              <div>
                <span className="label">P&L total</span>
                <strong className={pnlClass(displayAmount(position.totalPnL, position.totalPnLUsd, leg.currency, displayCurrency, usdArsRate))}>
                  {showAmount(position.totalPnL, position.totalPnLUsd, leg.currency)} (
                  {formatPct(
                    pctOf(
                      displayAmount(position.totalPnL, position.totalPnLUsd, leg.currency, displayCurrency, usdArsRate),
                      displayAmount(position.costBasis, position.costBasisUsd, leg.currency, displayCurrency, usdArsRate) +
                        displayAmount(position.realizedCostBasis, position.realizedCostBasisUsd, leg.currency, displayCurrency, usdArsRate),
                    ),
                  )}
                  )
                </strong>
              </div>
            </div>

            <div className="price-box">
              <div>
                <span className="label">{isQuoteVenue(leg.venue) ? PRICE_LABEL[leg.venue] : 'Precio actual'}</span>
                {editingPrice ? (
                  <div className="inline-edit">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={priceDraft}
                      onChange={(event) => setPriceDraft(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => {
                        void run(
                          () => onUpdateAsset(leg.id, { current_price: Number(priceDraft) }),
                          'No se pudo actualizar el precio',
                        )
                          .then(() => setEditingPrice(false))
                          .catch(() => undefined)
                      }}
                    >
                      Guardar
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setEditingPrice(false)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <strong>{formatMoney(Number(leg.current_price), leg.currency)}</strong>
                )}
              </div>
              {!editingPrice ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setPriceDraft(String(leg.current_price))
                    setEditingPrice(true)
                  }}
                >
                  Actualizar precio
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="empty">No está cargada esta plaza.</p>
        )}
      </div>

      {leg ? (
        <div className="panel">
          <h3>{editingMovement ? 'Editar movimiento' : `Nuevo movimiento · ${leg.symbol}`}</h3>
          <MovementForm
            key={editingMovement?.id ?? `new-${leg.id}`}
            initial={editingMovement ?? undefined}
            submitLabel={busy ? 'Guardando…' : editingMovement ? 'Guardar cambios' : 'Guardar movimiento'}
            onSubmit={async (data) => {
              try {
                if (editingMovement) {
                  await run(
                    () => onUpdateMovement(editingMovement.id, data),
                    'No se pudo actualizar el movimiento',
                  )
                  setEditingMovement(null)
                  return
                }
                await run(() => onCreateMovement(leg.id, data), 'No se pudo guardar el movimiento')
              } catch {
                return
              }
            }}
            onCancel={editingMovement ? () => setEditingMovement(null) : undefined}
          />
        </div>
      ) : null}

      {leg ? (
        <div className="panel">
          <h3>Historial · {leg.symbol}</h3>
          <MovementList
            movements={legMovements}
            currency={leg.currency}
            onEdit={(movement) => setEditingMovement(movement)}
            onDelete={onDeleteMovement}
          />
        </div>
      ) : null}
    </>
  )
}
