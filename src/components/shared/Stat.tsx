import { O, BK } from './constants'

export default function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4" style={{ borderLeftColor: color || O }}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: color || BK }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
