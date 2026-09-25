import { formatMoney, formatPct } from '../lib/portfolio'
import type { CurrencyCode } from '../types'

export interface ChartSlice {
  id: string
  label: string
  value: number
  pct: number
  color: string
}

interface AllocationChartProps {
  slices: ChartSlice[]
  currency: CurrencyCode
  title?: string
  onSliceClick?: (id: string) => void
  onBack?: () => void
  backLabel?: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

export function AllocationChart({
  slices,
  currency,
  title,
  onSliceClick,
  onBack,
  backLabel = 'Volver a tipos',
}: AllocationChartProps) {
  const visible = slices.filter((slice) => slice.value > 0)

  if (visible.length === 0) {
    return <p className="empty">Sin datos para el gráfico todavía.</p>
  }

  let angle = 0
  const paths = visible.map((slice) => {
    const sweep = (slice.pct / 100) * 360
    const start = angle
    const end = angle + Math.max(sweep, 0.01)
    angle = end
    return {
      ...slice,
      d: describeSlice(100, 100, 80, start, end),
    }
  })

  return (
    <div className="allocation-wrap">
      {title || onBack ? (
        <div className="allocation-toolbar">
          {onBack ? (
            <button type="button" className="btn ghost" onClick={onBack}>
              {backLabel}
            </button>
          ) : (
            <span />
          )}
          {title ? <h3>{title}</h3> : <span />}
        </div>
      ) : null}

      <div className="allocation-chart">
        <svg viewBox="0 0 200 200" className="pie-svg" aria-label={title ?? 'Composición'}>
          {paths.map((slice) => (
            <path
              key={slice.id}
              d={slice.d}
              fill={slice.color}
              className={onSliceClick ? 'pie-slice interactive' : 'pie-slice'}
              onClick={() => onSliceClick?.(slice.id)}
            >
              <title>
                {slice.label}: {formatMoney(slice.value, currency)} ({formatPct(slice.pct)})
              </title>
            </path>
          ))}
          <circle cx="100" cy="100" r="42" className="pie-hole" />
        </svg>
        <ul className="allocation-legend">
          {visible.map((slice) => (
            <li key={slice.id}>
              <button
                type="button"
                className={`legend-item ${onSliceClick ? 'interactive' : ''}`}
                onClick={() => onSliceClick?.(slice.id)}
                disabled={!onSliceClick}
              >
                <span className="swatch" style={{ background: slice.color }} />
                <div>
                  <strong>{slice.label}</strong>
                  <span className="muted">
                    {formatMoney(slice.value, currency)} · {formatPct(slice.pct)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
