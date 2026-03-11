'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import Stat from '../shared/Stat'
import AlertBadge from '../shared/AlertBadge'
import { O, G, R, BL, fmt, fmtN } from '../shared/constants'
import type { AnnualKPI, Alert, ZeroVisitAlert, LocationKPI, PhysicianRanking } from '@/lib/dataEngine'

export default function SummaryTab({
  annualKPIs,
  alerts,
  zeroVisitAlerts,
  locationKPIs,
  physicianRankings,
  years,
}: {
  annualKPIs: AnnualKPI[]
  alerts: Alert[]
  zeroVisitAlerts: ZeroVisitAlert[]
  locationKPIs: LocationKPI[]
  physicianRankings: PhysicianRanking[]
  years: number[]
}) {
  const ly = years[years.length - 1]
  const py = years.length > 1 ? years[years.length - 2] : null
  const la = annualKPIs.find((a) => a.year === ly)
  const pa = py ? annualKPIs.find((a) => a.year === py) : null

  const yoyCaseChange = la && pa ? ((la.totalCases - pa.totalCases) / pa.totalCases * 100).toFixed(1) : null
  const yoyRevChange = la && pa ? ((la.weightedRevenue - pa.weightedRevenue) / pa.weightedRevenue * 100).toFixed(1) : null

  const alertCounts = ['Gone Dark', 'Sharp Decline', 'Moderate Decline', 'Rising Star', 'New Relationship']
    .map((cat) => ({ name: cat, value: alerts.filter((a) => a.category === cat).length }))
    .filter((c) => c.value > 0)

  const COLORS = [R, '#F97316', '#EAB308', G, BL]

  const topPhysicians = physicianRankings.slice(0, 5)
  const topLocations = locationKPIs
    .filter((l) => l.year === ly)
    .sort((a, b) => b.weightedRev - a.weightedRev)
    .slice(0, 5)

  const totalLostRev = alerts
    .filter((a) => a.estRevImpact < 0)
    .reduce((sum, a) => sum + Math.abs(a.estRevImpact), 0)
  const totalGainedRev = alerts
    .filter((a) => a.estRevImpact > 0)
    .reduce((sum, a) => sum + a.estRevImpact, 0)
  const zeroVisitLost = zeroVisitAlerts.reduce((sum, z) => sum + z.estLostRev, 0)

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Title */}
      <div className="text-center py-2 print:py-1">
        <h2 className="text-lg font-bold" style={{ color: O }}>Executive Summary — {ly}</h2>
        {py && <p className="text-xs text-gray-500">Compared to {py}</p>}
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Cases" value={fmtN(la?.totalCases || 0)} sub={yoyCaseChange ? `${Number(yoyCaseChange) > 0 ? '+' : ''}${yoyCaseChange}% YoY` : ''} />
        <Stat label="Weighted Revenue" value={fmt(la?.weightedRevenue || 0)} sub={yoyRevChange ? `${Number(yoyRevChange) > 0 ? '+' : ''}${yoyRevChange}% YoY` : ''} color={G} />
        <Stat label="Tier A Payer %" value={`${la?.tierAPct || 0}%`} sub={pa ? `vs ${pa.tierAPct}%` : ''} color={G} />
        <Stat label="Active Physicians" value={fmtN(la?.uniquePhysicians || 0)} sub={pa ? `vs ${fmtN(pa.uniquePhysicians)}` : ''} color={BL} />
      </div>

      {/* Revenue impact + alert distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3" style={{ color: O }}>Revenue Impact Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">At-risk revenue (declines/gone dark)</span>
              <span className="text-sm font-bold text-red-600">-{fmt(totalLostRev)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">New/growing physician revenue</span>
              <span className="text-sm font-bold text-green-600">+{fmt(totalGainedRev)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Zero-visit lost revenue</span>
              <span className="text-sm font-bold text-red-600">-{fmt(zeroVisitLost)}</span>
            </div>
            <hr />
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-800">Net impact</span>
              <span className={`text-sm font-bold ${totalGainedRev - totalLostRev - zeroVisitLost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(Math.abs(totalGainedRev - totalLostRev - zeroVisitLost))}
                {totalGainedRev - totalLostRev - zeroVisitLost >= 0 ? ' gain' : ' at risk'}
              </span>
            </div>
          </div>
        </div>

        {alertCounts.length > 0 && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Alert Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={alertCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {alertCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top physicians + locations side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Top 5 Physicians by Revenue</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left">Physician</th>
                <th className="px-2 py-1 text-center">Evals</th>
                <th className="px-2 py-1 text-center">Revenue</th>
                <th className="px-2 py-1 text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {topPhysicians.map((p, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-2 py-1.5 font-medium">{p.physician}</td>
                  <td className="px-2 py-1.5 text-center">{p.totalEvals}</td>
                  <td className="px-2 py-1.5 text-center font-bold">{fmt(p.weightedRev)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      p.trend === 'Growing' ? 'bg-green-100 text-green-700' : p.trend === 'Declining' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>{p.trend}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Top 5 Locations ({ly})</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topLocations} layout="vertical" margin={{ left: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 9 }} />
              <YAxis dataKey="location" type="category" tick={{ fontSize: 10 }} width={70} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="weightedRev" fill={O} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical alerts */}
      {alerts.filter((a) => a.category === 'Gone Dark' || a.category === 'Sharp Decline').length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold text-red-600 mb-2">Critical Alerts — Immediate Action Needed</h3>
          <div className="space-y-1.5">
            {alerts
              .filter((a) => a.category === 'Gone Dark' || a.category === 'Sharp Decline')
              .slice(0, 10)
              .map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-gray-50">
                  <AlertBadge category={a.category} />
                  <span className="font-medium flex-1">{a.physician}</span>
                  <span className="text-gray-500">{a.location}</span>
                  <span className="text-red-600 font-bold">-{fmt(Math.abs(a.estRevImpact))}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
