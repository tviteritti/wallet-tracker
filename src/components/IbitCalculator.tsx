import { useState } from 'react'
import { buildIbitQuote, VENUE_LABELS, VENUE_SHORT } from '../lib/ibit'
import { formatMoney, formatPct, formatQty, pnlClass } from '../lib/portfolio'
import type { QuoteVenue } from '../types'

interface IbitCalculatorProps {
  btcPerShare: number
  cedearRatio: number
  usdArsRate: number
  referenceBtcPrice: number
  prices: Partial<Record<QuoteVenue, number>>
  busy: boolean
  onSaveParams: (btcPerShare: number, cedearRatio: number) => Promise<void>
  onApplyPrice: (venue: QuoteVenue, price: number) => Promise<void>
}

function formatBtcFraction(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 12 }).format(value)
}

export function IbitCalculator({
  btcPerShare,
  cedearRatio,
  usdArsRate,
  referenceBtcPrice,
  prices,
  busy,
  onSaveParams,
  onApplyPrice,
}: IbitCalculatorProps) {
  const [btcOverride, setBtcOverride] = useState<string | null>(null)
  const [shareOverride, setShareOverride] = useState<string | null>(null)
  const [ratioOverride, setRatioOverride] = useState<string | null>(null)

  const btcDraft = btcOverride ?? (referenceBtcPrice > 0 ? String(referenceBtcPrice) : '')
  const shareDraft = shareOverride ?? String(btcPerShare)
  const ratioDraft = ratioOverride ?? String(cedearRatio)
  const paramsDirty = shareOverride !== null || ratioOverride !== null

  const quote = buildIbitQuote({
    btcUsd: Number(btcDraft),
    btcPerShare: Number(shareDraft),
    cedearRatio: Number(ratioDraft),
    usdArsRate,
    prices,
  })

  return (
    <div className="ibit-calc">
      <h3>Calculadora contra BTC</h3>
      <p className="muted">
        Con el precio de BTC calcula el valor justo del CEDEAR. MEP y CCL se comparan en dólares.
        Pesos usa el tipo de cambio de la app (1 USD = {formatQty(usdArsRate)} ARS).
      </p>

      <div className="form-grid">
        <label className="span-2">
          Precio de BTC (USD)
          <input
            type="number"
            step="any"
            min="0"
            value={btcDraft}
            onChange={(event) => setBtcOverride(event.target.value)}
          />
        </label>
        <label>
          BTC por acción del ETF
          <input
            type="number"
            step="any"
            min="0"
            value={shareDraft}
            onChange={(event) => setShareOverride(event.target.value)}
          />
        </label>
        <label>
          CEDEARs por acción
          <input
            type="number"
            step="any"
            min="0"
            value={ratioDraft}
            onChange={(event) => setRatioOverride(event.target.value)}
          />
        </label>
      </div>

      <p className="muted calc-formula">
        Precio justo del CEDEAR en USD = precio BTC × BTC por acción ÷ ratio.
        {referenceBtcPrice > 0
          ? ` Tu BTC cargado está en ${formatMoney(referenceBtcPrice, 'USD')}.`
          : ''}
      </p>

      {paramsDirty ? (
        <div className="form-actions calc-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setShareOverride(null)
              setRatioOverride(null)
            }}
          >
            Descartar parámetros
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={busy || !(Number(shareDraft) > 0) || !(Number(ratioDraft) > 0)}
            onClick={() => {
              void onSaveParams(Number(shareDraft), Number(ratioDraft))
                .then(() => {
                  setShareOverride(null)
                  setRatioOverride(null)
                })
                .catch(() => undefined)
            }}
          >
            Guardar parámetros
          </button>
        </div>
      ) : null}

      {quote ? (
        <>
          <div className="calc-results">
            <div>
              <span className="label">1 CEDEAR</span>
              <strong>{formatBtcFraction(quote.btcPerCedear)} BTC</strong>
            </div>
            <div>
              <span className="label">ETF IBIT justo</span>
              <strong>{formatMoney(quote.etfUsd, 'USD')}</strong>
            </div>
            <div>
              <span className="label">CEDEAR justo</span>
              <strong>{formatMoney(quote.cedearUsd, 'USD')}</strong>
            </div>
            <div>
              <span className="label">CEDEAR justo en pesos</span>
              <strong>{usdArsRate > 0 ? formatMoney(quote.cedearArs, 'ARS') : '—'}</strong>
            </div>
          </div>

          <ul className="quote-list">
            {quote.legs.map((leg) => (
              <li key={leg.venue} className="quote-row" data-venue={leg.venue}>
                <div>
                  <strong>{VENUE_SHORT[leg.venue]}</strong>
                  <span className="muted">{VENUE_LABELS[leg.venue]}</span>
                </div>
                <div>
                  <span className="label">Cotización</span>
                  <span>
                    {leg.marketPrice > 0
                      ? formatMoney(leg.marketPrice, leg.venue === 'ars' ? 'ARS' : 'USD')
                      : 'Sin precio'}
                  </span>
                </div>
                <div>
                  <span className="label">Justo</span>
                  <span>
                    {leg.theoretical > 0
                      ? formatMoney(leg.theoretical, leg.venue === 'ars' ? 'ARS' : 'USD')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="label">Contra BTC</span>
                  {leg.gapPct == null ? (
                    <span className="muted">Sin cotización</span>
                  ) : (
                    <span className={pnlClass(-leg.gapPct)}>
                      {formatPct(leg.gapPct)} {leg.gapPct > 0 ? 'más caro' : leg.gapPct < 0 ? 'más barato' : 'en línea'}
                    </span>
                  )}
                </div>
                <div>
                  <span className="label">BTC implícito</span>
                  <span>
                    {leg.impliedBtc != null ? formatMoney(leg.impliedBtc, 'USD') : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy || !(leg.theoretical > 0)}
                  onClick={() => {
                    void onApplyPrice(leg.venue, leg.theoretical).catch(() => undefined)
                  }}
                >
                  Usar justo
                </button>
              </li>
            ))}
          </ul>

          {quote.impliedMep != null || quote.impliedCcl != null ? (
            <p className="muted calc-fx">
              {quote.impliedMep != null
                ? `Dólar implícito pesos/MEP: ${formatQty(quote.impliedMep)} ARS. `
                : ''}
              {quote.impliedCcl != null
                ? `Dólar implícito pesos/CCL: ${formatQty(quote.impliedCcl)} ARS.`
                : ''}
            </p>
          ) : null}
        </>
      ) : (
        <p className="empty">Ingresá el precio de BTC para ver el valor justo del CEDEAR.</p>
      )}
    </div>
  )
}
