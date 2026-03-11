'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import ExportButton from '../shared/ExportButton'
import { O, fmt, fmtN } from '../shared/constants'
import type { LocationKPI } from '@/lib/dataEngine'

export default function LocationsTab({
  locationKPIs,
  years,
}: {
  locationKPIs: LocationKPI[]
  years: number[]
}) {
  const py = years.length > 1 ? years[years.length - 2] : null

  const sorted = locationKPIs.sort((a, b) => a.location.localeCompare(b.location) || a.year - b.year)

  const exportRows = sorted.map((l) => ({
    location: l.location,
    year: l.year,
    totalCases: l.totalCases,
    totalVisits: l.totalVisits,
    weightedRev: l.weightedRev,
    avgRPV: l.avgRPV,
    avgVE: l.avgVE,
    arriveRate: l.arriveRate,
    otPct: l.otPct,
    uniquePhysicians: l.uniquePhysicians,
  }))

  const exportHeaders = [
    { key: 'location', label: 'Location' },
    { key: 'year', label: 'Year' },
    { key: 'totalCases', label: 'Cases' },
    { key: 'totalVisits', label: 'Visits' },
    { key: 'weightedRev', label: 'Wt. Revenue' },
    { key: 'avgRPV', label: 'RPV' },
    { key: 'avgVE', label: 'V/E' },
    { key: 'arriveRate', label: 'Arrive %' },
    { key: 'otPct', label: 'OT %' },
    { key: 'uniquePhysicians', label: 'Physicians' },
  ]

  return (
    <>
      {py && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>{py} Revenue by Location</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={locationKPIs.filter((l) => l.year === py).sort((a, b) => b.weightedRev - a.weightedRev)}
              layout="vertical"
              margin={{ left: 90 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 9 }} />
              <YAxis dataKey="location" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="weightedRev" name="Revenue" fill={O} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold" style={{ color: O }}>All Location KPIs</h3>
          <ExportButton rows={exportRows} headers={exportHeaders} fileName="location-kpis" />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: O }} className="text-white">
              <th className="px-2 py-1.5 text-left">Location</th>
              <th className="px-2 py-1.5 text-center">Year</th>
              <th className="px-2 py-1.5 text-center">Cases</th>
              <th className="px-2 py-1.5 text-center hidden sm:table-cell">Visits</th>
              <th className="px-2 py-1.5 text-center">Wt. Rev</th>
              <th className="px-2 py-1.5 text-center hidden md:table-cell">RPV</th>
              <th className="px-2 py-1.5 text-center hidden md:table-cell">V/E</th>
              <th className="px-2 py-1.5 text-center">Arrive %</th>
              <th className="px-2 py-1.5 text-center hidden md:table-cell">OT %</th>
              <th className="px-2 py-1.5 text-center hidden lg:table-cell">Physicians</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l, i) => (
              <tr key={i} className={i % 2 ? 'bg-orange-50/30' : ''}>
                <td className="px-2 py-1 font-medium">{l.location}</td>
                <td className="px-2 py-1 text-center">{l.year}</td>
                <td className="px-2 py-1 text-center">{fmtN(l.totalCases)}</td>
                <td className="px-2 py-1 text-center hidden sm:table-cell">{fmtN(l.totalVisits)}</td>
                <td className="px-2 py-1 text-center font-bold">{fmt(l.weightedRev)}</td>
                <td className="px-2 py-1 text-center hidden md:table-cell">${l.avgRPV}</td>
                <td className="px-2 py-1 text-center hidden md:table-cell">{l.avgVE}</td>
                <td className={`px-2 py-1 text-center ${l.arriveRate < 70 ? 'text-red-600 font-medium' : ''}`}>{l.arriveRate}%</td>
                <td className="px-2 py-1 text-center hidden md:table-cell">{l.otPct}%</td>
                <td className="px-2 py-1 text-center hidden lg:table-cell">{l.uniquePhysicians}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
