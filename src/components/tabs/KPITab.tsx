'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, CartesianGrid,
} from 'recharts'
import Stat from '../shared/Stat'
import { O, G, R, BK, fmt, fmtN } from '../shared/constants'
import type { AnnualKPI, MonthlyKPI } from '@/lib/dataEngine'

export default function KPITab({
  annualKPIs,
  monthlyKPIs,
  years,
}: {
  annualKPIs: AnnualKPI[]
  monthlyKPIs: MonthlyKPI[]
  years: number[]
}) {
  const ly = years[years.length - 1]
  const py = years.length > 1 ? years[years.length - 2] : null
  const la = annualKPIs.find((a) => a.year === ly)
  const pa = py ? annualKPIs.find((a) => a.year === py) : null
  const mf = monthlyKPIs.filter((m) => m.totalCases >= 50)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={`${ly} Total Cases`} value={fmtN(la?.totalCases || 0)} sub={pa ? `vs ${fmtN(pa.totalCases)} in ${py}` : ''} />
        <Stat label="Physician Referrals" value={fmtN(la?.physicianCases || 0)} sub={`${la?.physicianPct}% of total`} />
        <Stat label="Tier A %" value={`${la?.tierAPct}%`} sub={pa ? `vs ${pa.tierAPct}% in ${py}` : ''} color={G} />
        <Stat label="Weighted RPV" value={`$${la?.avgWeightedRPV}`} sub={pa ? `vs $${pa.avgWeightedRPV}` : ''} color={G} />
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Monthly Cases: Physician vs Non-Physician</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={mf}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={3} angle={-45} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="physCases" name="Physician" stackId="1" fill={O} stroke={O} fillOpacity={0.7} />
            <Area type="monotone" dataKey="nonPhysCases" name="Non-Physician" stackId="1" fill={BK} stroke={BK} fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Tier A Payer %</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mf}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={4} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
              <Tooltip /><Line type="monotone" dataKey="tierAPct" stroke={G} strokeWidth={2} dot={{ r: 1.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Arrival Rate %</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mf}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={4} />
              <YAxis domain={[55, 90]} tick={{ fontSize: 10 }} />
              <Tooltip /><Line type="monotone" dataKey="arriveRate" stroke={R} strokeWidth={2} dot={{ r: 1.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Annual table */}
      <div className="bg-white rounded-lg p-4 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Annual Comparison</h3>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: O }} className="text-white">
              <th className="px-2 py-1.5 text-left">KPI</th>
              {years.map((y) => <th key={y} className="px-2 py-1.5 text-center">{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              { l: 'Total Cases', f: (a: AnnualKPI) => fmtN(a.totalCases) },
              { l: 'Physician Cases', f: (a: AnnualKPI) => fmtN(a.physicianCases) },
              { l: 'Non-Physician', f: (a: AnnualKPI) => fmtN(a.nonPhysicianCases) },
              { l: 'Weighted Revenue', f: (a: AnnualKPI) => fmt(a.weightedRevenue) },
              { l: 'Avg RPV', f: (a: AnnualKPI) => `$${a.avgWeightedRPV}` },
              { l: 'Tier A %', f: (a: AnnualKPI) => `${a.tierAPct}%` },
              { l: 'OT %', f: (a: AnnualKPI) => `${a.otPct}%` },
              { l: 'Avg V/E', f: (a: AnnualKPI) => a.avgVE },
              { l: 'Physicians', f: (a: AnnualKPI) => fmtN(a.uniquePhysicians) },
            ].map((r, i) => (
              <tr key={i} className={i % 2 ? '' : 'bg-orange-50/40'}>
                <td className="px-2 py-1 font-medium">{r.l}</td>
                {years.map((y) => {
                  const a = annualKPIs.find((k) => k.year === y)
                  return <td key={y} className="px-2 py-1 text-center">{a ? r.f(a) : '—'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
