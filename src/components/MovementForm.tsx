import type { FormEvent } from 'react'
import type { Movement, MovementFormData, MovementType } from '../types'

interface MovementFormProps {
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

export function MovementForm({
  initial,
  submitLabel = 'Guardar movimiento',
  onSubmit,
  onCancel,
}: MovementFormProps) {
  const values = {
    movement_type: (initial?.movement_type ?? 'buy') as MovementType,
    quantity: initial?.quantity ?? '',
    price_per_unit: initial?.price_per_unit ?? '',
    fees: initial?.fees ?? 0,
    traded_at: toLocalInput(initial && 'traded_at' in initial ? initial.traded_at : undefined),
    notes: initial?.notes ?? '',
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await onSubmit({
      movement_type: String(form.get('movement_type') ?? 'buy') as MovementType,
      quantity: Number(form.get('quantity') ?? 0),
      price_per_unit: Number(form.get('price_per_unit') ?? 0),
      fees: Number(form.get('fees') ?? 0),
      traded_at: new Date(String(form.get('traded_at'))).toISOString(),
      notes: String(form.get('notes') ?? ''),
    })
    if (!initial) event.currentTarget.reset()
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit} key={initial && 'id' in initial ? initial.id : 'new'}>
      <div className="form-grid">
        <label>
          Tipo
          <select name="movement_type" defaultValue={values.movement_type}>
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
            name="quantity"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={values.quantity}
          />
        </label>
        <label>
          Precio unitario
          <input
            name="price_per_unit"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={values.price_per_unit}
          />
        </label>
        <label>
          Comisiones
          <input name="fees" type="number" step="any" min="0" defaultValue={values.fees} />
        </label>
        <label>
          Notas
          <input name="notes" placeholder="Opcional" defaultValue={values.notes ?? ''} />
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
