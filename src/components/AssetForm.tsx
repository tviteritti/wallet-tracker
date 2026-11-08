import { useState, type FormEvent } from 'react'
import type { AssetFormData, AssetType, CurrencyCode } from '../types'
import { ASSET_TYPE_LABELS, CURRENCIES, CURRENCY_LABELS } from '../types'

interface AssetFormProps {
  initial?: Partial<AssetFormData>
  submitLabel: string
  onSubmit: (data: AssetFormData) => Promise<void>
  onCancel?: () => void
}

const empty: AssetFormData = {
  name: '',
  symbol: '',
  asset_type: 'crypto',
  currency: 'USD',
  current_price: 0,
  cedear_ratio: null,
  notes: '',
}

export function AssetForm({ initial, submitLabel, onSubmit, onCancel }: AssetFormProps) {
  const values: AssetFormData = { ...empty, ...initial }
  const [assetType, setAssetType] = useState<AssetType>(values.asset_type)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await onSubmit({
      name: String(form.get('name') ?? ''),
      symbol: String(form.get('symbol') ?? ''),
      asset_type: assetType,
      currency: String(form.get('currency') ?? 'USD') as CurrencyCode,
      current_price: Number(form.get('current_price') ?? 0),
      cedear_ratio:
        assetType === 'cedear' && Number(form.get('cedear_ratio')) > 0
          ? Number(form.get('cedear_ratio'))
          : null,
      notes: String(form.get('notes') ?? ''),
    })
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Nombre
          <input name="name" required defaultValue={values.name} placeholder="Bitcoin" />
        </label>
        <label>
          Símbolo
          <input name="symbol" required defaultValue={values.symbol} placeholder="BTC" />
        </label>
        <label>
          Tipo
          <select
            name="asset_type"
            value={assetType}
            onChange={(event) => setAssetType(event.target.value as AssetType)}
          >
            {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((type) => (
              <option key={type} value={type}>
                {ASSET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Moneda
          <select name="currency" defaultValue={values.currency}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </option>
            ))}
          </select>
        </label>
        {assetType === 'cedear' ? (
          <label className="span-2">
            Ratio
            <input
              name="cedear_ratio"
              type="number"
              step="any"
              min="0"
              defaultValue={values.cedear_ratio ?? ''}
              placeholder="Cuántos CEDEARs equivalen a una acción"
            />
            <span className="muted">Precio en pesos = acción en USD × CCL / ratio.</span>
          </label>
        ) : null}
        <label className="span-2">
          Precio actual (manual)
          <input
            name="current_price"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={values.current_price}
          />
        </label>
        <label className="span-2">
          Notas
          <textarea name="notes" rows={2} defaultValue={values.notes} placeholder="Opcional" />
        </label>
      </div>
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
