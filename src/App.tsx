import { useMemo, useState } from 'react'
import { AssetCard, MovementList } from './components/AssetCard'
import { AssetForm } from './components/AssetForm'
import { LoginForm } from './components/LoginForm'
import { MovementForm } from './components/MovementForm'
import { useAuth } from './hooks/useAuth'
import { usePortfolio } from './hooks/usePortfolio'
import { computePosition, formatMoney, formatPct, formatQty, pnlClass } from './lib/portfolio'
import type { AssetFormData, MovementFormData } from './types'

type View = 'list' | 'create' | 'detail'

export default function App() {
  const { session, loading: authLoading, signIn, signOut } = useAuth()

  if (authLoading) {
    return (
      <div className="app-shell">
        <p className="empty">Cargando sesión…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginForm onSubmit={signIn} />
  }

  return <AuthenticatedApp email={session.user.email ?? ''} onSignOut={signOut} />
}

function AuthenticatedApp({
  email,
  onSignOut,
}: {
  email: string
  onSignOut: () => Promise<void>
}) {
  const {
    assets,
    movements,
    loading,
    error,
    createAsset,
    updateAsset,
    deleteAsset,
    createMovement,
    deleteMovement,
  } = usePortfolio()

  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const selected = assets.find((asset) => asset.id === selectedId) ?? null
  const assetMovements = useMemo(
    () => movements.filter((m) => m.asset_id === selectedId),
    [movements, selectedId],
  )

  const positions = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computePosition>>()
    for (const asset of assets) {
      const assetMoves = movements.filter((m) => m.asset_id === asset.id)
      map.set(asset.id, computePosition(assetMoves, Number(asset.current_price)))
    }
    return map
  }, [assets, movements])

  const totals = useMemo(() => {
    let marketValue = 0
    let costBasis = 0
    for (const asset of assets) {
      const position = positions.get(asset.id)
      if (!position) continue
      marketValue += position.marketValue
      costBasis += position.costBasis
    }
    const unrealizedPnL = marketValue - costBasis
    const unrealizedPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0
    return { marketValue, costBasis, unrealizedPnL, unrealizedPct }
  }, [assets, positions])

  async function handleCreateAsset(data: AssetFormData) {
    setBusy(true)
    setFormError(null)
    try {
      await createAsset(data)
      setView('list')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el activo')
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePrice() {
    if (!selected) return
    setBusy(true)
    setFormError(null)
    try {
      await updateAsset(selected.id, { current_price: Number(priceDraft) })
      setEditingPrice(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo actualizar el precio')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateMovement(data: MovementFormData) {
    if (!selected) return
    setBusy(true)
    setFormError(null)
    try {
      await createMovement(selected.id, data)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAsset() {
    if (!selected) return
    if (!confirm(`¿Eliminar ${selected.symbol} y todos sus movimientos?`)) return
    setBusy(true)
    try {
      await deleteAsset(selected.id)
      setSelectedId(null)
      setView('list')
    } finally {
      setBusy(false)
    }
  }

  const selectedPosition = selected ? positions.get(selected.id) : null

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Portfolio personal</p>
          <h1>Wallet Tracker</h1>
          <p className="muted session-email">{email}</p>
        </div>
        <div className="topbar-actions">
          {view === 'list' ? (
            <button type="button" className="btn primary" onClick={() => setView('create')}>
              Nuevo activo
            </button>
          ) : (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setView('list')
                setFormError(null)
                setEditingPrice(false)
              }}
            >
              Volver
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => void onSignOut()}>
            Salir
          </button>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {formError ? <div className="banner error">{formError}</div> : null}

      {view === 'list' ? (
        <>
          <section className="summary-strip">
            <div>
              <span className="label">Valor de mercado</span>
              <strong>{formatMoney(totals.marketValue)}</strong>
            </div>
            <div>
              <span className="label">Costo</span>
              <strong>{formatMoney(totals.costBasis)}</strong>
            </div>
            <div>
              <span className="label">P&L no realizado</span>
              <strong className={pnlClass(totals.unrealizedPnL)}>
                {formatMoney(totals.unrealizedPnL)} ({formatPct(totals.unrealizedPct)})
              </strong>
            </div>
          </section>

          {loading ? (
            <p className="empty">Cargando activos…</p>
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <h2>Todavía no cargaste activos</h2>
              <p>Empezá por agregar cripto, acciones, CEDEARs o bonos. Después cargá compras y ventas.</p>
              <button type="button" className="btn primary" onClick={() => setView('create')}>
                Agregar primer activo
              </button>
            </div>
          ) : (
            <div className="asset-grid">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  position={positions.get(asset.id)!}
                  selected={selectedId === asset.id}
                  onSelect={() => {
                    setSelectedId(asset.id)
                    setView('detail')
                    setEditingPrice(false)
                    setFormError(null)
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {view === 'create' ? (
        <section className="panel">
          <h2>Nuevo activo</h2>
          <p className="muted">
            Cargá el activo y su precio actual. Luego sumá la compra inicial como movimiento.
          </p>
          <AssetForm
            submitLabel={busy ? 'Guardando…' : 'Crear activo'}
            onSubmit={handleCreateAsset}
            onCancel={() => setView('list')}
          />
        </section>
      ) : null}

      {view === 'detail' && selected && selectedPosition ? (
        <section className="detail-layout">
          <div className="panel">
            <div className="detail-header">
              <div>
                <h2>
                  {selected.symbol} <span className="muted">· {selected.name}</span>
                </h2>
                <p className="muted">
                  Precio de compra promedio:{' '}
                  {selectedPosition.quantity > 0
                    ? formatMoney(selectedPosition.avgCost, selected.currency)
                    : '—'}
                </p>
              </div>
              <button type="button" className="btn ghost danger" onClick={() => void handleDeleteAsset()}>
                Eliminar
              </button>
            </div>

            <div className="detail-metrics">
              <div>
                <span className="label">Cantidad</span>
                <strong>{formatQty(selectedPosition.quantity)}</strong>
              </div>
              <div>
                <span className="label">Valor de mercado</span>
                <strong>{formatMoney(selectedPosition.marketValue, selected.currency)}</strong>
              </div>
              <div>
                <span className="label">Costo</span>
                <strong>{formatMoney(selectedPosition.costBasis, selected.currency)}</strong>
              </div>
              <div>
                <span className="label">P&L</span>
                <strong className={pnlClass(selectedPosition.unrealizedPnL)}>
                  {formatMoney(selectedPosition.unrealizedPnL, selected.currency)} (
                  {formatPct(selectedPosition.unrealizedPct)})
                </strong>
              </div>
            </div>

            <div className="price-box">
              <div>
                <span className="label">Precio actual (manual)</span>
                {editingPrice ? (
                  <div className="inline-edit">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => void handleSavePrice()}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setEditingPrice(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <strong>{formatMoney(Number(selected.current_price), selected.currency)}</strong>
                )}
              </div>
              {!editingPrice ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setPriceDraft(String(selected.current_price))
                    setEditingPrice(true)
                  }}
                >
                  Actualizar precio
                </button>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <h3>Nuevo movimiento</h3>
            <MovementForm onSubmit={handleCreateMovement} />
          </div>

          <div className="panel">
            <h3>Historial</h3>
            <MovementList
              movements={assetMovements}
              currency={selected.currency}
              onDelete={async (id) => {
                setBusy(true)
                try {
                  await deleteMovement(id)
                } finally {
                  setBusy(false)
                }
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
