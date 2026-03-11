'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
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
        <h3 className="text-sm font-bold mb-2" style={{ color: O }}>All Location KPIs</h3>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: O }} className="text-white">
              <th className="px-2 py-1.5 text-left">Location</th>
              <th className="px-2 py-1.5 text-center">Year</th>
              <th className="px-2 py-1.5 text-center">Cases</th>
              <th className="px-2 py-1.5 text-center">Visits</th>
              <th className="px-2 py-1.5 text-center">Wt. Rev</th>
              <th className="px-2 py-1.5 text-center">RPV</th>
              <th className="px-2 py-1.5 text-center">V/E</th>
              <th className="px-2 py-1.5 text-center">Arrive %</th>
              <th className="px-2 py-1.5 text-center">OT %</th>
              <th className="px-2 py-1.5 text-center">Physicians</th>
            </tr>
          </thead>
          <tbody>
            {locationKPIs
              .sort((a, b) => a.location.localeCompare(b.location) || a.year - b.year)
              .map((l, i) => (
                <tr key={i} className={i % 2 ? 'bg-orange-50/30' : ''}>
                  <td className="px-2 py-1 font-medium">{l.location}</td>
                  <td className="px-2 py-1 text-center">{l.year}</td>
                  <td className="px-2 py-1 text-center">{fmtN(l.totalCases)}</td>
                  <td className="px-2 py-1 text-center">{fmtN(l.totalVisits)}</td>
                  <td className="px-2 py-1 text-center font-bold">{fmt(l.weightedRev)}</td>
                  <td className="px-2 py-1 text-center">${l.avgRPV}</td>
                  <td className="px-2 py-1 text-center">{l.avgVE}</td>
                  <td className={`px-2 py-1 text-center ${l.arriveRate < 70 ? 'text-red-600 font-medium' : ''}`}>{l.arriveRate}%</td>
                  <td className="px-2 py-1 text-center">{l.otPct}%</td>
                  <td className="px-2 py-1 text-center">{l.uniquePhysicians}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
