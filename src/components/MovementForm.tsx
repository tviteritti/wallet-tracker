import type { FormEvent } from 'react'
import type { MovementFormData, MovementType } from '../types'

interface MovementFormProps {
  onSubmit: (data: MovementFormData) => Promise<void>
  onCancel?: () => void
}

function nowLocalInput(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export function MovementForm({ onSubmit, onCancel }: MovementFormProps) {
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
    event.currentTarget.reset()
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Tipo
          <select name="movement_type" defaultValue="buy">
            <option value="buy">Compra</option>
            <option value="sell">Venta</option>
          </select>
        </label>
        <label>
          Fecha
          <input name="traded_at" type="datetime-local" required defaultValue={nowLocalInput()} />
        </label>
        <label>
          Cantidad
          <input name="quantity" type="number" step="any" min="0" required />
        </label>
        <label>
          Precio unitario
          <input name="price_per_unit" type="number" step="any" min="0" required />
        </label>
        <label>
          Comisiones
          <input name="fees" type="number" step="any" min="0" defaultValue={0} />
        </label>
        <label>
          Notas
          <input name="notes" placeholder="Opcional" />
        </label>
      </div>
      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="btn primary">
          Guardar movimiento
        </button>
      </div>
    </form>
  )
}
