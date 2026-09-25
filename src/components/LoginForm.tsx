import { useState, type FormEvent } from 'react'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit(String(form.get('email') ?? ''), String(form.get('password') ?? ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card panel">
        <p className="eyebrow">Acceso privado</p>
        <h1>Wallet Tracker</h1>
        <p className="muted">Ingresá con tu cuenta para ver y gestionar tus activos.</p>

        <form className="panel-form" onSubmit={handleSubmit}>
          <div className="form-grid login-grid">
            <label className="span-2">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                defaultValue="tviteritti@gmail.com"
              />
            </label>
            <label className="span-2">
              Contraseña
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
          </div>

          {error ? <div className="banner error">{error}</div> : null}

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
