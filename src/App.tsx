import { useMemo, useState } from 'react'
import { AllocationChart } from './components/AllocationChart'
import { AssetCard, MovementList } from './components/AssetCard'
import { AssetForm } from './components/AssetForm'
import { LoginForm } from './components/LoginForm'
import { Modal } from './components/Modal'
import { MovementForm } from './components/MovementForm'
import { useAuth } from './hooks/useAuth'
import { usePortfolio } from './hooks/usePortfolio'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import {
  computePosition,
  convertAmount,
  formatMoney,
  formatPct,
  formatQty,
  pnlClass,
} from './lib/portfolio'
import type {
  AssetFormData,
  AssetType,
  CurrencyCode,
  Movement,
  MovementFormData,
} from './types'
import { ASSET_TYPE_LABELS, CURRENCIES } from './types'

type View = 'list' | 'create' | 'detail'
type TypeFilter = 'all' | AssetType
type SortMode = 'invested_desc' | 'invested_asc' | 'name'

type ConfirmState =
  | { kind: 'asset'; symbol: string }
  | { kind: 'movement'; movement: Movement }
  | null

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { session, loading: authLoading, signIn, signOut } = useAuth()

  if (authLoading) {
    return (
      <div className="app-shell">
        <p className="empty">Cargando sesión…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <button
          type="button"
          className="btn ghost theme-toggle floating"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
        >
          {theme === 'light' ? 'Modo noche' : 'Modo día'}
        </button>
        <LoginForm onSubmit={signIn} />
      </>
    )
  }

  return (
    <AuthenticatedApp
      email={session.user.email ?? ''}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  )
}

function AuthenticatedApp({
  email,
  onSignOut,
  theme,
  onToggleTheme,
}: {
  email: string
  onSignOut: () => Promise<void>
  theme: 'light' | 'dark'
  onToggleTheme: () => void
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
    updateMovement,
    deleteMovement,
  } = usePortfolio()

  const { usdArsRate, error: settingsError, updateUsdArsRate } = useSettings()

  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('USD')
  const [editingRate, setEditingRate] = useState(false)
  const [rateDraft, setRateDraft] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('invested_desc')
  const [confirm, setConfirm] = useState<ConfirmState>(null)

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

  const filteredAssets = useMemo(
    () =>
      typeFilter === 'all' ? assets : assets.filter((asset) => asset.asset_type === typeFilter),
    [assets, typeFilter],
  )

  const totals = useMemo(() => {
    let marketValue = 0
    let costBasis = 0
    for (const asset of filteredAssets) {
      const position = positions.get(asset.id)
      if (!position) continue
      marketValue += convertAmount(
        position.marketValue,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      costBasis += convertAmount(position.costBasis, asset.currency, displayCurrency, usdArsRate)
    }
    const unrealizedPnL = marketValue - costBasis
    const unrealizedPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0
    return { marketValue, costBasis, unrealizedPnL, unrealizedPct }
  }, [filteredAssets, positions, displayCurrency, usdArsRate])

  const allocation = useMemo(() => {
    const byType = new Map<AssetType, number>()
    for (const asset of filteredAssets) {
      const position = positions.get(asset.id)
      if (!position || position.marketValue <= 0) continue
      const value = convertAmount(
        position.marketValue,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      byType.set(asset.asset_type, (byType.get(asset.asset_type) ?? 0) + value)
    }
    const total = [...byType.values()].reduce((sum, value) => sum + value, 0)
    return [...byType.entries()]
      .map(([type, value]) => ({
        type,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredAssets, positions, displayCurrency, usdArsRate])

  const visibleAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'es')
      const investedA = convertAmount(
        positions.get(a.id)?.costBasis ?? 0,
        a.currency,
        displayCurrency,
        usdArsRate,
      )
      const investedB = convertAmount(
        positions.get(b.id)?.costBasis ?? 0,
        b.currency,
        displayCurrency,
        usdArsRate,
      )
      return sortMode === 'invested_desc' ? investedB - investedA : investedA - investedB
    })
  }, [filteredAssets, sortMode, positions, displayCurrency, usdArsRate])

  function goHome() {
    setView('list')
    setSelectedId(null)
    setEditingAsset(false)
    setEditingPrice(false)
    setEditingMovement(null)
    setFormError(null)
  }

  async function handleCreateAsset(data: AssetFormData) {
    setBusy(true)
    setFormError(null)
    try {
      await createAsset(data)
      goHome()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el activo')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateAsset(data: AssetFormData) {
    if (!selected) return
    setBusy(true)
    setFormError(null)
    try {
      await updateAsset(selected.id, data)
      setEditingAsset(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo actualizar el activo')
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

  async function handleSaveRate() {
    setBusy(true)
    setFormError(null)
    try {
      await updateUsdArsRate(Number(rateDraft))
      setEditingRate(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el tipo de cambio')
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

  async function handleUpdateMovement(data: MovementFormData) {
    if (!editingMovement) return
    setBusy(true)
    setFormError(null)
    try {
      await updateMovement(editingMovement.id, data)
      setEditingMovement(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo actualizar el movimiento')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmDelete() {
    if (!confirm) return
    setBusy(true)
    setFormError(null)
    try {
      if (confirm.kind === 'asset') {
        await deleteAsset(selectedId!)
        setConfirm(null)
        goHome()
      } else {
        await deleteMovement(confirm.movement.id)
        setConfirm(null)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo eliminar')
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
          <button type="button" className="brand-link" onClick={goHome}>
            <h1>Wallet Tracker</h1>
          </button>
          <p className="muted session-email">{email}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn ghost" onClick={onToggleTheme}>
            {theme === 'light' ? 'Modo noche' : 'Modo día'}
          </button>
          {view === 'list' ? (
            <button type="button" className="btn primary" onClick={() => setView('create')}>
              Nuevo activo
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={goHome}>
              Volver
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => void onSignOut()}>
            Salir
          </button>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {settingsError ? <div className="banner error">{settingsError}</div> : null}
      {formError ? <div className="banner error">{formError}</div> : null}

      {view === 'list' ? (
        <>
          <section className="controls-bar">
            <label className="control-field">
              Ver totales en
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-field">
              Tipo
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              >
                <option value="all">Todos</option>
                {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-field">
              Ordenar
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                <option value="invested_desc">Más invertido</option>
                <option value="invested_asc">Menos invertido</option>
                <option value="name">Nombre</option>
              </select>
            </label>

            <div className="control-field rate-field">
              <span>1 USD =</span>
              {editingRate ? (
                <div className="inline-edit">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={rateDraft}
                    onChange={(e) => setRateDraft(e.target.value)}
                    aria-label="Tipo de cambio USD a ARS"
                  />
                  <span>ARS</span>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void handleSaveRate()}
                  >
                    Guardar
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setEditingRate(false)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <strong>{formatQty(usdArsRate)} ARS</strong>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setRateDraft(String(usdArsRate))
                      setEditingRate(true)
                    }}
                  >
                    Actualizar TC
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="summary-strip">
            <div>
              <span className="label">Valor de mercado</span>
              <strong>{formatMoney(totals.marketValue, displayCurrency)}</strong>
            </div>
            <div>
              <span className="label">Costo</span>
              <strong>{formatMoney(totals.costBasis, displayCurrency)}</strong>
            </div>
            <div>
              <span className="label">P&L no realizado</span>
              <strong className={pnlClass(totals.unrealizedPnL)}>
                {formatMoney(totals.unrealizedPnL, displayCurrency)} ({formatPct(totals.unrealizedPct)})
              </strong>
            </div>
          </section>

          {filteredAssets.length > 0 ? (
            <section className="panel allocation-panel">
              <h2>Composición por tipo</h2>
              <AllocationChart slices={allocation} currency={displayCurrency} />
            </section>
          ) : null}

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
          ) : visibleAssets.length === 0 ? (
            <p className="empty">No hay activos para ese filtro.</p>
          ) : (
            <div className="asset-grid">
              {visibleAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  position={positions.get(asset.id)!}
                  displayCurrency={displayCurrency}
                  usdArsRate={usdArsRate}
                  selected={selectedId === asset.id}
                  onSelect={() => {
                    setSelectedId(asset.id)
                    setView('detail')
                    setEditingAsset(false)
                    setEditingPrice(false)
                    setEditingMovement(null)
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
            onCancel={goHome}
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
                  {ASSET_TYPE_LABELS[selected.asset_type]} · {selected.currency} · Precio promedio:{' '}
                  {selectedPosition.quantity > 0
                    ? formatMoney(selectedPosition.avgCost, selected.currency)
                    : '—'}
                </p>
              </div>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setEditingAsset((value) => !value)
                    setEditingPrice(false)
                    setEditingMovement(null)
                  }}
                >
                  {editingAsset ? 'Cerrar edición' : 'Editar activo'}
                </button>
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => setConfirm({ kind: 'asset', symbol: selected.symbol })}
                >
                  Eliminar
                </button>
              </div>
            </div>

            {editingAsset ? (
              <AssetForm
                initial={{
                  name: selected.name,
                  symbol: selected.symbol,
                  asset_type: selected.asset_type,
                  currency: selected.currency,
                  current_price: Number(selected.current_price),
                  notes: selected.notes ?? '',
                }}
                submitLabel={busy ? 'Guardando…' : 'Guardar cambios'}
                onSubmit={handleUpdateAsset}
                onCancel={() => setEditingAsset(false)}
              />
            ) : (
              <>
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
                      <strong>
                        {formatMoney(Number(selected.current_price), selected.currency)}
                      </strong>
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
              </>
            )}
          </div>

          <div className="panel">
            <h3>{editingMovement ? 'Editar movimiento' : 'Nuevo movimiento'}</h3>
            <MovementForm
              key={editingMovement?.id ?? 'new-movement'}
              initial={editingMovement ?? undefined}
              submitLabel={
                busy
                  ? 'Guardando…'
                  : editingMovement
                    ? 'Guardar cambios'
                    : 'Guardar movimiento'
              }
              onSubmit={editingMovement ? handleUpdateMovement : handleCreateMovement}
              onCancel={editingMovement ? () => setEditingMovement(null) : undefined}
            />
          </div>

          <div className="panel">
            <h3>Historial</h3>
            <MovementList
              movements={assetMovements}
              currency={selected.currency}
              onEdit={(movement) => {
                setEditingMovement(movement)
                setEditingAsset(false)
                setEditingPrice(false)
              }}
              onDelete={(movement) => setConfirm({ kind: 'movement', movement })}
            />
          </div>
        </section>
      ) : null}

      <Modal
        open={confirm?.kind === 'asset'}
        title="Eliminar activo"
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleConfirmDelete()}
      >
        <p>
          ¿Eliminar <strong>{confirm?.kind === 'asset' ? confirm.symbol : ''}</strong> y todos sus
          movimientos? Esta acción no se puede deshacer.
        </p>
      </Modal>

      <Modal
        open={confirm?.kind === 'movement'}
        title="Eliminar movimiento"
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleConfirmDelete()}
      >
        <p>¿Eliminar este movimiento del historial? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  )
}
