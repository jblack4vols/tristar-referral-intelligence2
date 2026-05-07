'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Stat from '../shared/Stat'
import ExportButton from '../shared/ExportButton'
import { O, G, BL, fmtN } from '../shared/constants'
import type { AnnualKPI, MonthlyKPI, OTPTRow } from '@/lib/dataEngine'

export default function OTPTTab({
  annualKPIs,
  monthlyKPIs,
  otPTSplit,
  years,
}: {
  annualKPIs: AnnualKPI[]
  monthlyKPIs: MonthlyKPI[]
  otPTSplit: OTPTRow[]
  years: number[]
}) {
  const py = years.length > 1 ? years[years.length - 2] : null
  const mf = monthlyKPIs.filter((m) => m.totalCases >= 50)

  const exportRows = otPTSplit.map((o) => ({
    year: o.year, location: o.location,
    ptCases: o.ptCases, otCases: o.otCases, otPct: o.otPct,
  }))

  const exportHeaders = [
    { key: 'year', label: 'Year' }, { key: 'location', label: 'Location' },
    { key: 'ptCases', label: 'PT Cases' }, { key: 'otCases', label: 'OT Cases' },
    { key: 'otPct', label: 'OT %' },
  ]

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
        {annualKPIs.map((a) => (
          <Stat key={a.year} label={`${a.year} OT`} value={fmtN(a.otCases)} sub={`${a.otPct}%`} color={a.otPct > 15 ? G : O} />
        ))}
        </div>
        <ExportButton rows={exportRows} headers={exportHeaders} fileName="ot-pt-split" />
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Monthly OT %</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={mf}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={3} angle={-45} textAnchor="end" height={40} />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip />
            <Area type="monotone" dataKey="otPct" name="OT %" fill={BL} stroke={BL} fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {py && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>OT by Location ({py})</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={otPTSplit.filter((o) => o.year === py && o.otPct > 0).sort((a, b) => b.otPct - a.otPct)}
              layout="vertical"
              margin={{ left: 90 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="location" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="otPct" name="OT %" fill={BL} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}
