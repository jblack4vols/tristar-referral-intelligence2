'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { O, BK, G, fmt, fmtN } from './constants'
import type { PhysicianRanking } from '@/lib/dataEngine'

export default function PhysicianModal({
  physician,
  years,
  onClose,
}: {
  physician: PhysicianRanking
  years: number[]
  onClose: () => void
}) {
  const yearChartData = years.map((y) => ({
    year: String(y),
    evals: physician.yearData[y]?.evals || 0,
    visits: physician.yearData[y]?.visits || 0,
  }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: BK }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: O }}>{physician.physician}</h2>
            <p className="text-xs text-gray-400">NPI: {physician.npi} &middot; {physician.location}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Evals</p>
              <p className="text-xl font-bold">{fmtN(physician.totalEvals)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Visits</p>
              <p className="text-xl font-bold">{fmtN(physician.totalVisits)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Wt. Revenue</p>
              <p className="text-xl font-bold" style={{ color: G }}>{fmt(physician.weightedRev)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Avg RPV</p>
              <p className="text-xl font-bold">${physician.avgRPV}</p>
            </div>
          </div>

          {/* Additional metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">V/E Ratio</p>
              <p className="text-lg font-bold">{physician.avgVE}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Tier A %</p>
              <p className="text-lg font-bold">{physician.tierAPct}%</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Trend</p>
              <p className={`text-lg font-bold ${
                physician.trend === 'Growing' ? 'text-green-600' : physician.trend === 'Declining' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {physician.trend}
              </p>
            </div>
          </div>

          {/* Dominant Payer */}
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Dominant Payer</p>
            <p className="text-sm font-semibold">{physician.dominantPayer || 'N/A'}</p>
          </div>

          {/* Year-over-year chart */}
          {yearChartData.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Year-over-Year Volume</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={yearChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="evals" name="Evals" fill={O} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="visits" name="Visits" fill={BK} radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Year data table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left">Year</th>
                <th className="px-2 py-1.5 text-center">Evals</th>
                <th className="px-2 py-1.5 text-center">Visits</th>
                <th className="px-2 py-1.5 text-center">V/E</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const d = physician.yearData[y]
                const evals = d?.evals || 0
                const visits = d?.visits || 0
                return (
                  <tr key={y} className="border-b border-gray-50">
                    <td className="px-2 py-1.5 font-medium">{y}</td>
                    <td className="px-2 py-1.5 text-center">{evals}</td>
                    <td className="px-2 py-1.5 text-center">{visits}</td>
                    <td className="px-2 py-1.5 text-center">{evals > 0 ? (visits / evals).toFixed(1) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
