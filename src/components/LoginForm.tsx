import { useState, type FormEvent } from 'react'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>
  onReset: (email: string) => Promise<void>
}

export function LoginForm({ onSubmit, onReset }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
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
          {info ? <p className="muted">{info}</p> : null}

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={(event) => {
                const form = event.currentTarget.form
                const email = form ? String(new FormData(form).get('email') ?? '') : ''
                if (!email.trim()) {
                  setError('Ingresá el email.')
                  return
                }
                setBusy(true)
                setError(null)
                setInfo(null)
                void onReset(email)
                  .then(() => {
                    setInfo('Te mandamos un mail para elegir una contraseña nueva.')
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'No se pudo enviar el mail')
                  })
                  .finally(() => setBusy(false))
              }}
            >
              Olvidé mi contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function NewPasswordForm({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña')
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card panel">
        <p className="eyebrow">Acceso privado</p>
        <h1>Nueva contraseña</h1>
        <p className="muted">Elegí una contraseña nueva para esta cuenta.</p>
        <form className="panel-form" onSubmit={handleSubmit}>
          <div className="form-grid login-grid">
            <label className="span-2">
              Contraseña nueva
              <input name="password" type="password" required autoComplete="new-password" minLength={6} />
            </label>
            <label className="span-2">
              Repetila
              <input name="confirm" type="password" required autoComplete="new-password" minLength={6} />
            </label>
          </div>
          {error ? <div className="banner error">{error}</div> : null}
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
