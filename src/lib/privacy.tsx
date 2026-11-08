import { createContext, useContext, useState, type ReactNode } from 'react'
import { formatMoney, formatQty } from './portfolio'
import type { CurrencyCode } from '../types'

const MASK = '••••'

interface PrivacyValue {
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyValue>({
  hidden: false,
  toggle: () => {},
})

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem('wallet-hide-amounts') === '1')

  const toggle = () => {
    setHidden((current) => {
      const next = !current
      localStorage.setItem('wallet-hide-amounts', next ? '1' : '0')
      return next
    })
  }

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
}

export function useAmounts() {
  const { hidden, toggle } = useContext(PrivacyContext)
  return {
    hidden,
    toggle,
    money: (value: number, currency: CurrencyCode = 'USD') => (hidden ? MASK : formatMoney(value, currency)),
    qty: (value: number) => (hidden ? MASK : formatQty(value)),
  }
}

export function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M1 1l22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
