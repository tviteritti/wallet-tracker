import { ASSET_TYPE_LABELS, type AssetType } from '../types'
import { formatMoney, formatPct } from '../lib/portfolio'
import type { CurrencyCode } from '../types'

export interface AllocationSlice {
  type: AssetType
  value: number
  pct: number
}

const SLICE_COLORS: Record<AssetType, string> = {
  crypto: '#1f6b63',
  stock: '#3aa691',
  cedear: '#7eb6a6',
  bond: '#c4a35a',
  etf: '#4f7cac',
  other: '#6b7c85',
}

interface AllocationChartProps {
  slices: AllocationSlice[]
  currency: CurrencyCode
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

export function AllocationChart({ slices, currency }: AllocationChartProps) {
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
      color: SLICE_COLORS[slice.type],
    }
  })

  return (
    <div className="allocation-chart">
      <svg viewBox="0 0 200 200" className="pie-svg" aria-label="Composición por tipo">
        {paths.map((slice) => (
          <path key={slice.type} d={slice.d} fill={slice.color} />
        ))}
        <circle cx="100" cy="100" r="42" className="pie-hole" />
      </svg>
      <ul className="allocation-legend">
        {visible.map((slice) => (
          <li key={slice.type}>
            <span className="swatch" style={{ background: SLICE_COLORS[slice.type] }} />
            <div>
              <strong>{ASSET_TYPE_LABELS[slice.type]}</strong>
              <span className="muted">
                {formatMoney(slice.value, currency)} · {formatPct(slice.pct)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
