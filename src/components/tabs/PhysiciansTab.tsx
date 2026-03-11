'use client'

import { useState } from 'react'
import { O, fmt } from '../shared/constants'
import type { PhysicianRanking } from '@/lib/dataEngine'

export default function PhysiciansTab({
  physicianRankings,
  years,
  allLocations,
}: {
  physicianRankings: PhysicianRanking[]
  years: number[]
  allLocations: string[]
}) {
  const [search, setSearch] = useState('')
  const [locFilter, setLocFilter] = useState('All')

  return (
    <>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          placeholder="Search physician, NPI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs px-3 py-1.5 border rounded-lg"
        />
        <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="text-xs border rounded px-2 py-1.5 bg-white">
          {allLocations.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr style={{ backgroundColor: O }} className="text-white">
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5 text-left">Physician</th>
              <th className="px-2 py-1.5 text-left">Location</th>
              {years.map((y) => <th key={y} className="px-2 py-1.5 text-center">{y}</th>)}
              <th className="px-2 py-1.5 text-center">Wt. Rev</th>
              <th className="px-2 py-1.5 text-center">V/E</th>
              <th className="px-2 py-1.5 text-center">Tier A</th>
              <th className="px-2 py-1.5 text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {physicianRankings
              .filter((p) => {
                if (search && !p.physician.toLowerCase().includes(search.toLowerCase()) && !p.npi.includes(search)) return false
                if (locFilter !== 'All' && p.location !== locFilter) return false
                return true
              })
              .slice(0, 100)
              .map((p, i) => (
                <tr key={`${p.npi}-${p.location}`} className={i % 2 ? 'bg-orange-50/30' : ''}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 font-medium">{p.physician}</td>
                  <td className="px-2 py-1 text-gray-500">{p.location}</td>
                  {years.map((y) => <td key={y} className="px-2 py-1 text-center">{p.yearData[y]?.evals || 0}</td>)}
                  <td className="px-2 py-1 text-center font-bold">{fmt(p.weightedRev)}</td>
                  <td className="px-2 py-1 text-center">{p.avgVE}</td>
                  <td className="px-2 py-1 text-center">{p.tierAPct}%</td>
                  <td className="px-2 py-1 text-center">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        p.trend === 'Declining' ? 'bg-red-100 text-red-700' : p.trend === 'Growing' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.trend}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
