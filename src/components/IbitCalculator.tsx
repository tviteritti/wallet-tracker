import { useState } from 'react'
import { buildIbitQuote } from '../lib/ibit'
import { useAmounts } from '../lib/privacy'
import { formatPct, pnlClass } from '../lib/portfolio'
import type { QuoteVenue } from '../types'

export interface LiveCalcInput {
  btc: number
  mepRate: number
  cclRate: number
  prices: Partial<Record<QuoteVenue, number>>
  stamp: string
}

interface IbitCalculatorProps {
  btcPerShare: number
  cedearRatio: number
  referenceBtcPrice: number
  prices: Partial<Record<QuoteVenue, number>>
  live: LiveCalcInput | null
  busy: boolean
  onApplyPrice: (venue: QuoteVenue, price: number) => Promise<void>
}

interface CalcDraft {
  btc: string
  mepRate: string
  cclRate: string
  ars: string
  mep: string
  ccl: string
}

const STORAGE_KEY = 'wallet-tracker:ibit-calc'

const PRICE_FIELDS: { venue: QuoteVenue; key: 'ars' | 'mep' | 'ccl'; label: string }[] = [
  { venue: 'ars', key: 'ars', label: 'Precio en pesos (IBIT)' },
  { venue: 'mep', key: 'mep', label: 'Precio en dólares MEP (IBITD)' },
  { venue: 'ccl', key: 'ccl', label: 'Precio en dólares CCL (IBITC)' },
]

function correlationText(gapPct: number): string {
  if (Math.abs(gapPct) < 0.05) return 'en línea con BTC'
  if (gapPct > 0) return `${formatPct(gapPct)} más caro que BTC`
  return `${formatPct(gapPct)} más barato que BTC`
}

function readDraft(): CalcDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CalcDraft>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      btc: String(parsed.btc ?? ''),
      mepRate: String(parsed.mepRate ?? ''),
      cclRate: String(parsed.cclRate ?? ''),
      ars: String(parsed.ars ?? ''),
      mep: String(parsed.mep ?? ''),
      ccl: String(parsed.ccl ?? ''),
    }
  } catch {
    return null
  }
}

function withMarket(current: CalcDraft | null, market: LiveCalcInput): CalcDraft {
  const base: CalcDraft = current ?? {
    btc: '',
    mepRate: '',
    cclRate: '',
    ars: '',
    mep: '',
    ccl: '',
  }
  const active = document.activeElement
  const field = active instanceof HTMLInputElement ? active.dataset.calcField : undefined
  const next: CalcDraft = { ...base }
  const fill = (key: keyof CalcDraft, value: number) => {
    if (field === key || !(value > 0)) return
    next[key] = String(value)
  }
  fill('btc', market.btc)
  fill('mepRate', market.mepRate)
  fill('cclRate', market.cclRate)
  fill('ars', market.prices.ars ?? 0)
  fill('mep', market.prices.mep ?? 0)
  fill('ccl', market.prices.ccl ?? 0)
  return next
}

function writeDraft(draft: CalcDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // El cálculo sigue en memoria si el navegador no guarda.
  }
}

export function IbitCalculator({
  btcPerShare,
  cedearRatio,
  referenceBtcPrice,
  prices,
  live,
  busy,
  onApplyPrice,
}: IbitCalculatorProps) {
  const { money } = useAmounts()
  const [draft, setDraft] = useState<CalcDraft | null>(() => readDraft())
  const [seenStamp, setSeenStamp] = useState<string | null>(null)
  const stamp = live?.stamp ?? null
  if (stamp !== seenStamp) {
    setSeenStamp(stamp)
    if (live?.stamp) {
      const next = withMarket(draft, live)
      writeDraft(next)
      setDraft(next)
    }
  }

  const fromPortfolio: CalcDraft = {
    btc: referenceBtcPrice > 0 ? String(referenceBtcPrice) : '',
    mepRate: '',
    cclRate: '',
    ars: (prices.ars ?? 0) > 0 ? String(prices.ars) : '',
    mep: (prices.mep ?? 0) > 0 ? String(prices.mep) : '',
    ccl: (prices.ccl ?? 0) > 0 ? String(prices.ccl) : '',
  }
  const shown = draft ?? fromPortfolio

  function update(partial: Partial<CalcDraft>) {
    const next = { ...shown, ...partial }
    setDraft(next)
    writeDraft(next)
  }

  const quote = buildIbitQuote({
    btcUsd: Number(shown.btc),
    btcPerShare,
    cedearRatio,
    mepRate: Number(shown.mepRate),
    cclRate: Number(shown.cclRate),
    prices: {
      ars: Number(shown.ars),
      mep: Number(shown.mep),
      ccl: Number(shown.ccl),
    },
  })

  return (
    <div className="ibit-calc">
      <h3>Calculadora contra BTC</h3>
      <p className="muted">
        BTC, MEP, CCL y los tres precios entran solos. Podés corregir un campo a mano: se respeta
        mientras lo estás editando.
      </p>

      <div className="calc-inputs">
        <label>
          Precio de BTC (USD)
          <input
            type="number"
            step="any"
            min="0"
            data-calc-field="btc"
            value={shown.btc}
            onChange={(event) => update({ btc: event.target.value })}
          />
        </label>
        <label>
          Dólar MEP (pesos por dólar)
          <input
            type="number"
            step="any"
            min="0"
            data-calc-field="mepRate"
            value={shown.mepRate}
            placeholder="Ej. 1617"
            onChange={(event) => update({ mepRate: event.target.value })}
          />
        </label>
        <label>
          Dólar CCL (pesos por dólar)
          <input
            type="number"
            step="any"
            min="0"
            data-calc-field="cclRate"
            value={shown.cclRate}
            placeholder="Ej. 1651"
            onChange={(event) => update({ cclRate: event.target.value })}
          />
        </label>
      </div>

      {quote ? (
        <p className="calc-fair">
          Con ese BTC, el CEDEAR debería valer {money(quote.cedearUsd, 'USD')}.
          {quote.viaMep ? ` En pesos, con tu MEP: ${money(quote.viaMep.fairArs, 'ARS')}.` : ' Falta el dólar MEP para el precio en pesos.'}
          {quote.viaCcl ? ` Con tu CCL: ${money(quote.viaCcl.fairArs, 'ARS')}.` : ' Falta el dólar CCL para el otro precio en pesos.'}
        </p>
      ) : (
        <p className="empty">Ingresá el precio de BTC.</p>
      )}

      <ul className="quote-list">
        {PRICE_FIELDS.map((field) => {
          const typed = Number(shown[field.key])
          const saved = prices[field.venue] ?? 0
          const dirty = typed > 0 && Math.abs(typed - saved) > 1e-6
          const usd = field.venue === 'mep' ? quote?.mep : field.venue === 'ccl' ? quote?.ccl : null

          return (
            <li key={field.venue} className="quote-row" data-venue={field.venue}>
              <label>
                {field.label}
                <input
                  type="number"
                  step="any"
                  min="0"
                  data-calc-field={field.key}
                  value={shown[field.key]}
                  placeholder="Precio del broker"
                  onChange={(event) => update({ [field.key]: event.target.value })}
                />
              </label>
              <div className="quote-readout">
                {field.venue === 'ars' ? (
                  <PesoReadout quote={quote} />
                ) : usd?.impliedBtc != null && usd.gapPct != null ? (
                  <>
                    <span className="label">Debería valer {money(usd.fairUsd, 'USD')}</span>
                    <strong className={pnlClass(-usd.gapPct)}>
                      Equivale a BTC {money(usd.impliedBtc, 'USD')}, {correlationText(usd.gapPct)}
                    </strong>
                  </>
                ) : (
                  <span className="muted">Cargá el precio que ves en el broker.</span>
                )}
              </div>
              {dirty ? (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    void onApplyPrice(field.venue, typed).catch(() => undefined)
                  }}
                >
                  Guardar
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PesoReadout({ quote }: { quote: ReturnType<typeof buildIbitQuote> }) {
  if (!quote) return <span className="muted">Ingresá el precio de BTC.</span>
  if (!(quote.pesoPrice > 0)) return <span className="muted">Cargá el precio que ves en el broker.</span>
  if (!quote.viaMep && !quote.viaCcl) {
    return <span className="muted">Cargá el dólar MEP y el dólar CCL para comparar este precio con BTC.</span>
  }

  return (
    <>
      {quote.viaMep ? <PesoLine name="MEP" check={quote.viaMep} /> : <span className="muted">Falta el dólar MEP.</span>}
      {quote.viaCcl ? <PesoLine name="CCL" check={quote.viaCcl} /> : <span className="muted">Falta el dólar CCL.</span>}
    </>
  )
}

function PesoLine({ name, check }: { name: string; check: NonNullable<IbitQuotePeso> }) {
  const { money } = useAmounts()
  return (
    <p className="peso-line">
      <span className="label">
        Con dólar {name}: debería valer {money(check.fairArs, 'ARS')}
        {check.versusUsdVenuePct != null
          ? `. Contra la plaza ${name}, ${plazaText(check.versusUsdVenuePct)}`
          : ''}
      </span>
      {check.impliedBtc != null && check.gapPct != null ? (
        <strong className={pnlClass(-check.gapPct)}>
          Equivale a BTC {money(check.impliedBtc, 'USD')}, {correlationText(check.gapPct)}
        </strong>
      ) : null}
    </p>
  )
}

type IbitQuotePeso = NonNullable<ReturnType<typeof buildIbitQuote>>['viaMep']

function plazaText(gapPct: number): string {
  if (Math.abs(gapPct) < 0.05) return 'está en línea.'
  if (gapPct > 0) return `está ${formatPct(gapPct)} más caro.`
  return `está ${formatPct(gapPct)} más barato.`
}
