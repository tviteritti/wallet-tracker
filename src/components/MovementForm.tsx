import { useMemo, useState, type FormEvent } from 'react'
import { convertAmount, formatMoney } from '../lib/portfolio'
import type { CurrencyCode, Movement, MovementFormData, MovementType } from '../types'
import { CURRENCIES } from '../types'

type EntryMode = 'unit' | 'total'

interface MovementFormProps {
  assetCurrency: CurrencyCode
  initial?: Partial<MovementFormData> | Movement
  submitLabel?: string
  onSubmit: (data: MovementFormData) => Promise<void>
  onCancel?: () => void
}

function toLocalInput(iso?: string): string {
  const date = iso ? new Date(iso) : new Date()
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function toAssetAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  fxRate: number | null,
): number | null {
  if (from === to) return amount
  if (fxRate == null || !(fxRate > 0)) return null
  return convertAmount(amount, from, to, fxRate)
}

export function MovementForm({
  assetCurrency,
  initial,
  submitLabel = 'Guardar movimiento',
  onSubmit,
  onCancel,
}: MovementFormProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>(initial ? 'unit' : 'total')
  const [movementType, setMovementType] = useState<MovementType>(
    (initial?.movement_type ?? 'buy') as MovementType,
  )
  const [quantity, setQuantity] = useState(
    initial?.quantity != null ? String(initial.quantity) : '',
  )
  const [pricePerUnit, setPricePerUnit] = useState(
    initial?.price_per_unit != null ? String(initial.price_per_unit) : '',
  )
  const [totalSpent, setTotalSpent] = useState('')
  const [spentCurrency, setSpentCurrency] = useState<CurrencyCode>(assetCurrency)
  const [fees, setFees] = useState(initial?.fees != null ? String(initial.fees) : '0')
  const [feesCurrency, setFeesCurrency] = useState<CurrencyCode>(assetCurrency)
  const [fxRate, setFxRate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const spentNeedsFx = entryMode === 'total' && spentCurrency !== assetCurrency
  const feesNeedFx = feesCurrency !== assetCurrency
  const needsFx = spentNeedsFx || feesNeedFx
  const parsedFx = needsFx ? Number(fxRate) : null
  const fxReady = !needsFx || (parsedFx != null && parsedFx > 0 && !Number.isNaN(parsedFx))

  const derivedUnitPrice = useMemo(() => {
    if (entryMode !== 'total') return null
    const qty = Number(quantity)
    const total = Number(totalSpent)
    if (!(qty > 0) || !(total >= 0) || Number.isNaN(qty) || Number.isNaN(total)) return null
    if (!fxReady) return null
    const converted = toAssetAmount(total, spentCurrency, assetCurrency, parsedFx)
    if (converted == null) return null
    return converted / qty
  }, [entryMode, quantity, totalSpent, fxReady, spentCurrency, assetCurrency, parsedFx])

  const derivedFees = useMemo(() => {
    const feeAmount = Number(fees)
    if (Number.isNaN(feeAmount) || feeAmount < 0) return null
    if (!fxReady) return null
    return toAssetAmount(feeAmount, feesCurrency, assetCurrency, parsedFx)
  }, [fees, feesCurrency, assetCurrency, fxReady, parsedFx])

  function handleSpentCurrencyChange(code: CurrencyCode) {
    setSpentCurrency(code)
    setFeesCurrency(code)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const qty = Number(quantity)
    const feeAmount = Number(fees)
    if (!(qty > 0) || Number.isNaN(qty)) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }
    if (Number.isNaN(feeAmount) || feeAmount < 0) {
      setError('La comisión no puede ser negativa.')
      return
    }
    if (needsFx && !fxReady) {
      setError('Ingresá el tipo de cambio (ARS por 1 USD).')
      return
    }

    let unitPrice: number
    if (entryMode === 'unit') {
      unitPrice = Number(pricePerUnit)
      if (!(unitPrice >= 0) || Number.isNaN(unitPrice)) {
        setError('Ingresá un precio unitario válido.')
        return
      }
    } else {
      const total = Number(totalSpent)
      if (!(total >= 0) || Number.isNaN(total)) {
        setError(movementType === 'sell' ? 'Ingresá cuánto cobraste.' : 'Ingresá cuánto gastaste.')
        return
      }
      const converted = toAssetAmount(total, spentCurrency, assetCurrency, parsedFx)
      if (converted == null) {
        setError('No se pudo convertir el monto.')
        return
      }
      unitPrice = converted / qty
    }

    const feesNative = toAssetAmount(feeAmount, feesCurrency, assetCurrency, parsedFx)
    if (feesNative == null) {
      setError('No se pudo convertir la comisión.')
      return
    }

    try {
      await onSubmit({
        movement_type: movementType,
        quantity: qty,
        price_per_unit: unitPrice,
        fees: feesNative,
        traded_at: new Date(String(form.get('traded_at'))).toISOString(),
        notes: String(form.get('notes') ?? ''),
      })
    } catch {
      return
    }

    if (!initial) {
      setQuantity('')
      setPricePerUnit('')
      setTotalSpent('')
      setFxRate('')
      setFees('0')
      setSpentCurrency(assetCurrency)
      setFeesCurrency(assetCurrency)
      event.currentTarget.reset()
    }
  }

  const values = {
    traded_at: toLocalInput(initial && 'traded_at' in initial ? initial.traded_at : undefined),
    notes: initial?.notes ?? '',
  }

  return (
    <form
      className="panel-form"
      onSubmit={handleSubmit}
      key={initial && 'id' in initial ? initial.id : 'new'}
    >
      <div className="entry-mode-toggle" role="group" aria-label="Cómo cargar el movimiento">
        <button
          type="button"
          className={entryMode === 'total' ? 'btn primary' : 'btn ghost'}
          onClick={() => setEntryMode('total')}
        >
          Cantidad + gasto
        </button>
        <button
          type="button"
          className={entryMode === 'unit' ? 'btn primary' : 'btn ghost'}
          onClick={() => setEntryMode('unit')}
        >
          Precio unitario
        </button>
      </div>

      <div className="form-grid">
        <label>
          Tipo
          <select
            name="movement_type"
            value={movementType}
            onChange={(event) => setMovementType(event.target.value as MovementType)}
          >
            <option value="buy">Compra</option>
            <option value="sell">Venta</option>
          </select>
        </label>
        <label>
          Fecha
          <input name="traded_at" type="datetime-local" required defaultValue={values.traded_at} />
        </label>
        <label>
          Cantidad
          <input
            type="number"
            step="any"
            min="0"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>

        {entryMode === 'unit' ? (
          <label>
            Precio unitario ({assetCurrency})
            <input
              type="number"
              step="any"
              min="0"
              required
              value={pricePerUnit}
              onChange={(event) => setPricePerUnit(event.target.value)}
            />
          </label>
        ) : (
          <label>
            {movementType === 'sell' ? 'Monto cobrado (sin comisión)' : 'Monto gastado (sin comisión)'}
            <div className="input-with-suffix">
              <input
                type="number"
                step="any"
                min="0"
                required
                value={totalSpent}
                onChange={(event) => setTotalSpent(event.target.value)}
                placeholder="Ej. 150000"
              />
              <select
                value={spentCurrency}
                onChange={(event) => handleSpentCurrencyChange(event.target.value as CurrencyCode)}
                aria-label="Moneda del monto"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </label>
        )}

        <label>
          Comisiones
          <div className="input-with-suffix">
            <input
              type="number"
              step="any"
              min="0"
              value={fees}
              onChange={(event) => setFees(event.target.value)}
            />
            <select
              value={feesCurrency}
              onChange={(event) => setFeesCurrency(event.target.value as CurrencyCode)}
              aria-label="Moneda de la comisión"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </label>

        {needsFx ? (
          <label>
            Tipo de cambio (ARS por 1 USD)
            <input
              type="number"
              step="any"
              min="0"
              required
              value={fxRate}
              onChange={(event) => setFxRate(event.target.value)}
              placeholder="Ej. 1400"
            />
          </label>
        ) : null}

        <label>
          Notas
          <input name="notes" placeholder="Opcional" defaultValue={values.notes ?? ''} />
        </label>
      </div>

      {entryMode === 'total' && derivedUnitPrice != null ? (
        <p className="muted entry-preview">
          Precio unitario: {formatMoney(derivedUnitPrice, assetCurrency)}
          {derivedFees != null && derivedFees > 0
            ? ` · comisión: ${formatMoney(derivedFees, assetCurrency)}`
            : null}
          {needsFx ? ` · en ${assetCurrency}` : null}
        </p>
      ) : null}

      {entryMode === 'unit' && feesNeedFx && derivedFees != null && derivedFees > 0 ? (
        <p className="muted entry-preview">
          Comisión: {formatMoney(derivedFees, assetCurrency)}
        </p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="btn primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
