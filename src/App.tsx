import { useMemo, useState } from 'react'
import { AllocationChart, type ChartSlice } from './components/AllocationChart'
import { AssetCard, MovementList } from './components/AssetCard'
import { AssetForm } from './components/AssetForm'
import { FxRatesPanel } from './components/FxRatesPanel'
import { LoginForm } from './components/LoginForm'
import { Modal } from './components/Modal'
import { MovementForm } from './components/MovementForm'
import { useAuth } from './hooks/useAuth'
import { useDailyFxRates } from './hooks/useDailyFxRates'
import { usePortfolio } from './hooks/usePortfolio'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import {
  computePosition,
  displayAmount,
  formatMoney,
  formatPct,
  formatQty,
  pctOf,
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

type View = 'list' | 'create' | 'detail' | 'fx'
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
  const {
    rates: dailyRates,
    rateMap,
    error: fxError,
    upsertRate,
    deleteRate,
  } = useDailyFxRates()

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
  const [chartFocus, setChartFocus] = useState<AssetType | null>(null)

  const TYPE_COLORS: Record<AssetType, string> = {
    crypto: '#1f6b63',
    stock: '#3aa691',
    cedear: '#7eb6a6',
    bond: '#c4a35a',
    etf: '#4f7cac',
    fiat: '#8fa37a',
    other: '#6b7c85',
  }

  const ASSET_SLICE_COLORS = ['#1f6b63', '#3aa691', '#7eb6a6', '#c4a35a', '#4f7cac', '#8fa37a', '#6b7c85', '#a8c5ae']

  const selected = assets.find((asset) => asset.id === selectedId) ?? null
  const assetMovements = useMemo(
    () => movements.filter((m) => m.asset_id === selectedId),
    [movements, selectedId],
  )

  const positions = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computePosition>>()
    for (const asset of assets) {
      const assetMoves = movements.filter((m) => m.asset_id === asset.id)
      map.set(
        asset.id,
        computePosition(
          assetMoves,
          Number(asset.current_price),
          asset.currency,
          rateMap,
          usdArsRate,
        ),
      )
    }
    return map
  }, [assets, movements, rateMap, usdArsRate])

  const filteredAssets = useMemo(
    () =>
      typeFilter === 'all' ? assets : assets.filter((asset) => asset.asset_type === typeFilter),
    [assets, typeFilter],
  )

  const totals = useMemo(() => {
    let marketValue = 0
    let costBasis = 0
    let unrealizedPnL = 0
    let realizedPnL = 0
    let realizedCost = 0
    let totalPnL = 0
    let missingFx = 0

    for (const asset of filteredAssets) {
      const position = positions.get(asset.id)
      if (!position) continue
      missingFx += position.missingFxDates.length
      marketValue += displayAmount(
        position.marketValue,
        position.marketValueUsd,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      costBasis += displayAmount(
        position.costBasis,
        position.costBasisUsd,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      unrealizedPnL += displayAmount(
        position.unrealizedPnL,
        position.unrealizedPnLUsd,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      realizedPnL += displayAmount(
        position.realizedPnL,
        position.realizedPnLUsd,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      realizedCost += displayAmount(
        position.realizedCostBasis,
        position.realizedCostBasisUsd,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
      totalPnL += displayAmount(
        position.totalPnL,
        position.totalPnLUsd,
        asset.currency,
        displayCurrency,
        usdArsRate,
      )
    }

    return {
      marketValue,
      costBasis,
      unrealizedPnL,
      unrealizedPct: pctOf(unrealizedPnL, costBasis),
      realizedPnL,
      realizedPct: pctOf(realizedPnL, realizedCost),
      totalPnL,
      totalPct: pctOf(totalPnL, costBasis + realizedCost),
      missingFx,
    }
  }, [filteredAssets, positions, displayCurrency, usdArsRate])

  const allocation = useMemo(() => {
    const byType = new Map<AssetType, number>()
    for (const asset of filteredAssets) {
      const position = positions.get(asset.id)
      if (!position || position.marketValue <= 0) continue
      const value = displayAmount(
        position.marketValue,
        position.marketValueUsd,
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

  const chartSlices: ChartSlice[] = useMemo(() => {
    if (!chartFocus) {
      return allocation.map((slice) => ({
        id: slice.type,
        label: ASSET_TYPE_LABELS[slice.type],
        value: slice.value,
        pct: slice.pct,
        color: TYPE_COLORS[slice.type],
      }))
    }

    const focused = filteredAssets.filter((asset) => asset.asset_type === chartFocus)
    const values = focused.map((asset) => {
      const position = positions.get(asset.id)
      const value = position
        ? displayAmount(
            position.marketValue,
            position.marketValueUsd,
            asset.currency,
            displayCurrency,
            usdArsRate,
          )
        : 0
      return { asset, value }
    })
    const total = values.reduce((sum, item) => sum + Math.max(item.value, 0), 0)
    return values
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        id: item.asset.id,
        label: `${item.asset.symbol} · ${item.asset.name}`,
        value: item.value,
        pct: total > 0 ? (item.value / total) * 100 : 0,
        color: ASSET_SLICE_COLORS[index % ASSET_SLICE_COLORS.length],
      }))
  }, [allocation, chartFocus, filteredAssets, positions, displayCurrency, usdArsRate])

  const visibleAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'es')
      const investedA = displayAmount(
        positions.get(a.id)?.costBasis ?? 0,
        positions.get(a.id)?.costBasisUsd ?? null,
        a.currency,
        displayCurrency,
        usdArsRate,
      )
      const investedB = displayAmount(
        positions.get(b.id)?.costBasis ?? 0,
        positions.get(b.id)?.costBasisUsd ?? null,
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
    setChartFocus(null)
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
          <button type="button" className="btn ghost" onClick={() => setView('fx')}>
            TC diarios
            {totals.missingFx > 0 ? ` (${totals.missingFx})` : ''}
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
      {fxError ? <div className="banner error">{fxError}</div> : null}
      {formError ? <div className="banner error">{formError}</div> : null}

      {view === 'fx' ? (
        <FxRatesPanel
          assets={assets}
          movements={movements}
          rates={dailyRates}
          busy={busy}
          onSave={async (rateDate, rate) => {
            setBusy(true)
            setFormError(null)
            try {
              await upsertRate(rateDate, rate)
            } catch (err) {
              setFormError(err instanceof Error ? err.message : 'No se pudo guardar el TC')
            } finally {
              setBusy(false)
            }
          }}
          onDelete={async (rateDate) => {
            setBusy(true)
            setFormError(null)
            try {
              await deleteRate(rateDate)
            } catch (err) {
              setFormError(err instanceof Error ? err.message : 'No se pudo eliminar el TC')
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}

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

          <section className="summary-strip summary-strip-wide">
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
            <div>
              <span className="label">P&L realizado</span>
              <strong className={pnlClass(totals.realizedPnL)}>
                {formatMoney(totals.realizedPnL, displayCurrency)} ({formatPct(totals.realizedPct)})
              </strong>
            </div>
            <div>
              <span className="label">P&L total</span>
              <strong className={pnlClass(totals.totalPnL)}>
                {formatMoney(totals.totalPnL, displayCurrency)} ({formatPct(totals.totalPct)})
              </strong>
            </div>
          </section>

          {totals.missingFx > 0 ? (
            <div className="banner warn">
              Hay movimientos en ARS sin tipo de cambio diario. Cargalos en{' '}
              <button type="button" className="linkish" onClick={() => setView('fx')}>
                TC diarios
              </button>{' '}
              para ver el P&amp;L en USD con historial correcto.
            </div>
          ) : null}

          {filteredAssets.length > 0 ? (
            <section className="panel allocation-panel">
              <h2>Composición {chartFocus ? `· ${ASSET_TYPE_LABELS[chartFocus]}` : 'por tipo'}</h2>
              <p className="muted chart-hint">
                {chartFocus
                  ? 'Distribución de activos de este tipo. Tocá uno para abrir el detalle.'
                  : 'Tocá un tipo para ver cómo se reparte entre tus activos.'}
              </p>
              <AllocationChart
                slices={chartSlices}
                currency={displayCurrency}
                onBack={chartFocus ? () => setChartFocus(null) : undefined}
                onSliceClick={(id) => {
                  if (!chartFocus) {
                    setChartFocus(id as AssetType)
                    return
                  }
                  setSelectedId(id)
                  setView('detail')
                  setEditingAsset(false)
                  setEditingPrice(false)
                  setEditingMovement(null)
                  setFormError(null)
                }}
              />
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
          <section className="controls-bar">
            <label className="control-field">
              Ver en
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
            {selected.currency === 'ARS' && selectedPosition.missingFxDates.length > 0 ? (
              <p className="muted">
                Faltan TC diarios — el P&amp;L en USD puede ser aproximado.{' '}
                <button type="button" className="linkish" onClick={() => setView('fx')}>
                  Cargar TC
                </button>
              </p>
            ) : null}
          </section>

          <div className="panel">
            <div className="detail-header">
              <div>
                <h2>
                  {selected.symbol} <span className="muted">· {selected.name}</span>
                </h2>
                <p className="muted">
                  {ASSET_TYPE_LABELS[selected.asset_type]} · nativo {selected.currency} · Precio
                  promedio:{' '}
                  {selectedPosition.quantity > 0
                    ? formatMoney(
                        displayAmount(
                          selectedPosition.avgCost,
                          selected.currency === 'USD'
                            ? selectedPosition.avgCost
                            : selectedPosition.costBasisUsd != null &&
                                selectedPosition.quantity > 0
                              ? selectedPosition.costBasisUsd / selectedPosition.quantity
                              : null,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        ),
                        displayCurrency,
                      )
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
                    <strong>
                      {formatMoney(
                        displayAmount(
                          selectedPosition.marketValue,
                          selectedPosition.marketValueUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        ),
                        displayCurrency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="label">Costo</span>
                    <strong>
                      {formatMoney(
                        displayAmount(
                          selectedPosition.costBasis,
                          selectedPosition.costBasisUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        ),
                        displayCurrency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="label">P&L no realizado</span>
                    <strong
                      className={pnlClass(
                        displayAmount(
                          selectedPosition.unrealizedPnL,
                          selectedPosition.unrealizedPnLUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        ),
                      )}
                    >
                      {(() => {
                        const unrealized = displayAmount(
                          selectedPosition.unrealizedPnL,
                          selectedPosition.unrealizedPnLUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        const invested = displayAmount(
                          selectedPosition.costBasis,
                          selectedPosition.costBasisUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        return `${formatMoney(unrealized, displayCurrency)} (${formatPct(pctOf(unrealized, invested))})`
                      })()}
                    </strong>
                  </div>
                  <div>
                    <span className="label">P&L realizado</span>
                    <strong
                      className={pnlClass(
                        displayAmount(
                          selectedPosition.realizedPnL,
                          selectedPosition.realizedPnLUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        ),
                      )}
                    >
                      {(() => {
                        const realized = displayAmount(
                          selectedPosition.realizedPnL,
                          selectedPosition.realizedPnLUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        const realizedCost = displayAmount(
                          selectedPosition.realizedCostBasis,
                          selectedPosition.realizedCostBasisUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        return `${formatMoney(realized, displayCurrency)} (${formatPct(pctOf(realized, realizedCost))})`
                      })()}
                    </strong>
                  </div>
                  <div>
                    <span className="label">P&L total</span>
                    <strong
                      className={pnlClass(
                        displayAmount(
                          selectedPosition.totalPnL,
                          selectedPosition.totalPnLUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        ),
                      )}
                    >
                      {(() => {
                        const total = displayAmount(
                          selectedPosition.totalPnL,
                          selectedPosition.totalPnLUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        const invested = displayAmount(
                          selectedPosition.costBasis,
                          selectedPosition.costBasisUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        const realizedCost = displayAmount(
                          selectedPosition.realizedCostBasis,
                          selectedPosition.realizedCostBasisUsd,
                          selected.currency,
                          displayCurrency,
                          usdArsRate,
                        )
                        return `${formatMoney(total, displayCurrency)} (${formatPct(pctOf(total, invested + realizedCost))})`
                      })()}
                    </strong>
                  </div>
                </div>

                <div className="price-box">
                  <div>
                    <span className="label">Precio actual (manual, {selected.currency})</span>
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
