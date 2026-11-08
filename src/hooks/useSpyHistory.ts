import { useEffect, useState } from 'react'
import { fetchSpyHistory, type SpyClose } from '../lib/spy'

export function useSpyHistory(enabled: boolean) {
  const [closes, setCloses] = useState<SpyClose[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setStatus('loading')
    setError(null)
    fetchSpyHistory()
      .then((history) => {
        if (cancelled) return
        setCloses(history)
        setStatus(history.length > 0 ? 'ready' : 'error')
        if (history.length === 0) setError('No se pudo leer el histórico de SPY')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'No se pudo leer el histórico de SPY')
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { closes, status, error }
}
