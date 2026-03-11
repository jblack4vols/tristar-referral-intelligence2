export const O = '#FF8200'
export const P = '#FFEAD5'
export const BK = '#000000'
export const G = '#16A34A'
export const R = '#DC2626'
export const BL = '#2563EB'

export const fmt = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`

export const fmtN = (n: number) => (n >= 1e3 ? n.toLocaleString() : String(n))

export const TABS = [
  { id: 'kpi', label: 'KPI Trends' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'physicians', label: 'Physicians' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'otpt', label: 'OT vs PT' },
  { id: 'locations', label: 'Locations' },
]
