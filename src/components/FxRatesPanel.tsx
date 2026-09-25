import { useMemo, useState } from 'react'
import type { Asset, DailyFxRate, Movement } from '../types'
import { formatQty, formatRateDate, toRateDate } from '../lib/portfolio'

interface FxRatesPanelProps {
  assets: Asset[]
  movements: Movement[]
  rates: DailyFxRate[]
  busy?: boolean
  onSave: (rateDate: string, usdArsRate: number) => Promise<void>
  onDelete: (rateDate: string) => Promise<void>
}

export function FxRatesPanel({
  assets,
  movements,
  rates,
  busy = false,
  onSave,
  onDelete,
}: FxRatesPanelProps) {
  const arsAssetIds = useMemo(
    () => new Set(assets.filter((asset) => asset.currency === 'ARS').map((asset) => asset.id)),
    [assets],
  )

  const movementCountByDate = useMemo(() => {
    const counts = new Map<string, number>()
    for (const movement of movements) {
      if (!arsAssetIds.has(movement.asset_id)) continue
      const date = toRateDate(movement.traded_at)
      counts.set(date, (counts.get(date) ?? 0) + 1)
    }
    return counts
  }, [movements, arsAssetIds])

  const pendingDates = useMemo(() => {
    const loaded = new Set(rates.map((rate) => rate.rate_date))
    return [...movementCountByDate.keys()]
      .filter((date) => !loaded.has(date))
      .sort((a, b) => b.localeCompare(a))
  }, [movementCountByDate, rates])

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function savePending(date: string) {
    const value = Number(drafts[date] ?? 0)
    if (!value || value <= 0) {
      setError('Ingresá un tipo de cambio válido')
      return
    }
    setError(null)
    await onSave(date, value)
    setDrafts((current) => {
      const next = { ...current }
      delete next[date]
      return next
    })
  }

  async function saveEdit() {
    if (!editDate) return
    const value = Number(editValue)
    if (!value || value <= 0) {
      setError('Ingresá un tipo de cambio válido')
      return
    }
    setError(null)
    await onSave(editDate, value)
    setEditDate(null)
  }

  return (
    <div className="fx-panel">
      <section className="panel">
        <h2>Tipos de cambio por día</h2>
        <p className="muted">
          Solo se listan días con movimientos en ARS. Cargás el CCL una vez por día y se reutiliza
          en todas las operaciones de esa fecha para el P&amp;L en dólares.
        </p>
        {error ? <div className="banner error">{error}</div> : null}
      </section>

      <section className="panel">
        <h3>Pendientes ({pendingDates.length})</h3>
        {pendingDates.length === 0 ? (
          <p className="empty">No hay días pendientes: todos los movimientos en ARS tienen TC.</p>
        ) : (
          <ul className="fx-list">
            {pendingDates.map((date) => (
              <li key={date}>
                <div>
                  <strong>{formatRateDate(date)}</strong>
                  <span className="muted">
                    {movementCountByDate.get(date)} movimiento
                    {(movementCountByDate.get(date) ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="inline-edit">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="1 USD = ? ARS"
                    value={drafts[date] ?? ''}
                    onChange={(e) =>
                      setDrafts((current) => ({ ...current, [date]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void savePending(date)}
                  >
                    Guardar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Cargados ({rates.length})</h3>
        {rates.length === 0 ? (
          <p className="empty">Todavía no cargaste tipos de cambio diarios.</p>
        ) : (
          <ul className="fx-list">
            {rates.map((rate) => (
              <li key={rate.rate_date}>
                <div>
                  <strong>{formatRateDate(rate.rate_date)}</strong>
                  <span className="muted">
                    {movementCountByDate.get(rate.rate_date)
                      ? `${movementCountByDate.get(rate.rate_date)} mov.`
                      : 'Sin movimientos'}
                  </span>
                </div>
                {editDate === rate.rate_date ? (
                  <div className="inline-edit">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => void saveEdit()}
                    >
                      Guardar
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setEditDate(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="movement-meta">
                    <strong>1 USD = {formatQty(Number(rate.usd_ars_rate))} ARS</strong>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setEditDate(rate.rate_date)
                        setEditValue(String(rate.usd_ars_rate))
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={() => void onDelete(rate.rate_date)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
