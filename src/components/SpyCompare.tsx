import { formatPct, formatRateDate, pctOf, pnlClass } from '../lib/portfolio'
import { useAmounts } from '../lib/privacy'
import type { ReturnLines } from '../lib/returns'
import type { SpyComparison, SpyMonth } from '../lib/spy'

interface SpyCompareProps {
  comparison: SpyComparison | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  lines: ReturnLines | null
  linesStatus: 'idle' | 'loading' | 'ready' | 'error'
  linesError: string | null
}

function usd(value: number, hidden: boolean): string {
  if (hidden) return '••••'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function monthLabel(month: string, withYear: boolean): string {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('es-AR', {
    month: 'short',
    year: withYear ? '2-digit' : undefined,
  })
}

function monthGain(months: SpyMonth[], index: number): number {
  const current = months[index].spy - months[index].invested
  if (index === 0) return current
  const previous = months[index - 1].spy - months[index - 1].invested
  return current - previous
}

function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  const out: T[] = []
  for (let index = 0; index < points.length; index += step) out.push(points[index])
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

function axisPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(0)}%`
}

function PercentChart({ lines }: { lines: ReturnLines }) {
  const points = thin(lines.points, 360)
  const width = 720
  const plotH = 240
  const pad = { l: 58, r: 16, t: 16, b: 36 }
  const height = pad.t + plotH + pad.b
  const values = points.flatMap((point) => [point.portfolio, point.spy])
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const innerW = width - pad.l - pad.r
  const xAt = (index: number) =>
    points.length <= 1 ? pad.l + innerW / 2 : pad.l + (index / (points.length - 1)) * innerW
  const yAt = (value: number) => pad.t + (1 - (value - min) / span) * plotH
  const path = (key: 'portfolio' | 'spy') =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(1)} ${yAt(point[key]).toFixed(1)}`)
      .join(' ')
  const labelStep = Math.max(1, Math.ceil(points.length / 6))

  return (
    <svg className="spy-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución en porcentaje de la cartera y de SPY">
      <line x1={pad.l} x2={width - pad.r} y1={yAt(0)} y2={yAt(0)} stroke="var(--line)" />
      <text x={4} y={yAt(max) + 4} className="spy-axis">
        {axisPct(max)}
      </text>
      {min < 0 ? (
        <text x={4} y={yAt(min)} className="spy-axis">
          {axisPct(min)}
        </text>
      ) : null}
      <path d={path('spy')} fill="none" stroke="var(--teal-soft)" strokeWidth="2.5" />
      <path d={path('portfolio')} fill="none" stroke="#c4a35a" strokeWidth="2.5" />
      {points.map((point, index) =>
        index % labelStep === 0 || index === points.length - 1 ? (
          <text
            key={point.date}
            x={xAt(index)}
            y={height - 8}
            className="spy-axis"
            textAnchor={index === points.length - 1 ? 'end' : 'middle'}
          >
            {formatRateDate(point.date)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

function Outcome({
  title,
  detail,
  value,
  gain,
}: {
  title: string
  detail: string
  value: number
  gain: number
}) {
  const { hidden } = useAmounts()
  return (
    <article className="compare-card">
      <h3>{title}</h3>
      <p className="muted">{detail}</p>
      <strong>{usd(value, hidden)}</strong>
      <span className={pnlClass(gain)}>
        {usd(gain, hidden)} ({formatPct(pctOf(gain, value - gain))})
      </span>
    </article>
  )
}

export function SpyCompare({ comparison, status, error, lines, linesStatus, linesError }: SpyCompareProps) {
  const { hidden } = useAmounts()
  const invested = comparison?.invested ?? 0
  const portfolioGain = comparison ? comparison.portfolioUsd - invested : 0
  const spyGain = comparison ? comparison.spyValue - invested : 0

  return (
    <section className="panel spy-panel">
      <h2>Cartera contra SPY</h2>
      <p className="muted chart-hint">
        Las dos líneas arrancan en cero el día de la primera compra. Muestran cuánto subió o bajó el
        precio, sin contar la plata que fuiste poniendo.
      </p>

      {linesStatus === 'loading' ? <p className="empty">Armando la evolución de precios…</p> : null}
      {linesStatus === 'error' ? <p className="error">{linesError ?? 'No se pudo armar la evolución'}</p> : null}
      {lines && lines.points.length > 0 ? (
        <>
          <PercentChart lines={lines} />
          <div className="spy-legend">
            <span>
              <i className="swatch cartera" /> Cartera {formatPct(lines.points[lines.points.length - 1].portfolio)}
            </span>
            <span>
              <i className="swatch spy" /> SPY {formatPct(lines.points[lines.points.length - 1].spy)}
            </span>
          </div>
          {lines.flat.length > 0 ? (
            <p className="muted chart-hint">
              Sin cotización diaria, al precio de compra: {lines.flat.join(', ')}.
            </p>
          ) : null}
        </>
      ) : null}

      <h3 className="compare-subtitle">Si el mismo dinero iba a dólares o a SPY</h3>

      {status === 'loading' || status === 'idle' ? <p className="empty">Leyendo el histórico de SPY…</p> : null}
      {status === 'error' ? <p className="error">{error ?? 'No se pudo leer el histórico de SPY'}</p> : null}
      {status === 'ready' && !comparison ? (
        <p className="empty">Cuando haya compras, se puede comparar.</p>
      ) : null}

      {comparison ? (
        <>
          <div className="compare-cards">
            <Outcome title="Dólares" detail="Sin invertir" value={invested} gain={0} />
            <Outcome
              title="Tu cartera"
              detail="Lo que vale hoy"
              value={comparison.portfolioUsd}
              gain={portfolioGain}
            />
            <Outcome title="SPY" detail="El mismo dinero invertido" value={comparison.spyValue} gain={spyGain} />
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Aportaste</th>
                  <th>Ganancia SPY</th>
                  <th>Acumulado</th>
                  <th>Si era SPY</th>
                </tr>
              </thead>
              <tbody>
                {comparison.months.map((month, index) => {
                  const gain = monthGain(comparison.months, index)
                  return (
                    <tr key={month.month}>
                      <td>{monthLabel(month.month, true)}</td>
                      <td className={pnlClass(month.contributed)}>{usd(month.contributed, hidden)}</td>
                      <td className={pnlClass(gain)}>{usd(gain, hidden)}</td>
                      <td>{usd(month.invested, hidden)}</td>
                      <td>{usd(month.spy, hidden)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="muted chart-hint">
            Desde {monthLabel(comparison.months[0]?.month ?? comparison.firstDate.slice(0, 7), true)}. Cierres de
            SPY, Yahoo. Montos en dólares.
          </p>
          {comparison.skippedFx > 0 ? (
            <p className="muted chart-hint">
              Hay movimientos en pesos sin TC de ese día. Esos aportes no entran.
            </p>
          ) : null}
          {!comparison.portfolioComplete ? (
            <p className="muted chart-hint">Falta TC para valuar parte de la cartera en USD.</p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
