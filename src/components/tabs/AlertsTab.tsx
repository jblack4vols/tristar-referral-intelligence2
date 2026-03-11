'use client'

import { useState } from 'react'
import Stat from '../shared/Stat'
import AlertBadge from '../shared/AlertBadge'
import ExportButton from '../shared/ExportButton'
import { R, G, BL } from '../shared/constants'
import type { Alert, ZeroVisitAlert } from '@/lib/dataEngine'

export default function AlertsTab({
  alerts,
  zeroVisitAlerts,
  years,
  allLocations,
}: {
  alerts: Alert[]
  zeroVisitAlerts: ZeroVisitAlert[]
  years: number[]
  allLocations: string[]
}) {
  const [search, setSearch] = useState('')
  const [locFilter, setLocFilter] = useState('All')

  const ly = years[years.length - 1]
  const py = years.length > 1 ? years[years.length - 2] : null

  if (alerts.length === 0) {
    return <div className="bg-white rounded-lg p-8 text-center text-gray-400 shadow-sm">Need 2+ years for alerts.</div>
  }

  const filtered = alerts.filter((a) => {
    if (search && !a.physician.toLowerCase().includes(search.toLowerCase())) return false
    if (locFilter !== 'All' && a.location !== locFilter) return false
    return true
  })

  const exportRows = filtered.map((a) => ({
    category: a.category,
    physician: a.physician,
    npi: a.npi,
    location: a.location,
    evalsPrior: a.evalsOld,
    evalsCurrent: a.evalsNew,
    pctChange: a.pctChange !== null ? `${a.pctChange}%` : 'New',
    estRevImpact: a.estRevImpact,
  }))

  const exportHeaders = [
    { key: 'category', label: 'Category' },
    { key: 'physician', label: 'Physician' },
    { key: 'npi', label: 'NPI' },
    { key: 'location', label: 'Location' },
    { key: 'evalsPrior', label: `${py} Evals` },
    { key: 'evalsCurrent', label: `${ly} Evals` },
    { key: 'pctChange', label: 'Change %' },
    { key: 'estRevImpact', label: 'Est. Revenue Impact' },
  ]

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['Gone Dark', 'Sharp Decline', 'Moderate Decline', 'Rising Star', 'New Relationship'].map((cat) => {
          const n = alerts.filter((a) => a.category === cat).length
          const cl: Record<string, string> = {
            'Gone Dark': R, 'Sharp Decline': '#F97316', 'Moderate Decline': '#EAB308', 'Rising Star': G, 'New Relationship': BL,
          }
          return <Stat key={cat} label={cat} value={String(n)} color={cl[cat]} />
        })}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          placeholder="Search physician..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs px-3 py-1.5 border rounded-lg"
        />
        <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="text-xs border rounded px-2 py-1.5 bg-white">
          {allLocations.map((l) => <option key={l}>{l}</option>)}
        </select>
        <div className="ml-auto">
          <ExportButton rows={exportRows} headers={exportHeaders} fileName="physician-alerts" />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-left">Physician</th>
              <th className="px-2 py-2 text-left hidden sm:table-cell">Location</th>
              <th className="px-2 py-2 text-center">{py}</th>
              <th className="px-2 py-2 text-center">{ly}</th>
              <th className="px-2 py-2 text-center">&Delta;%</th>
              <th className="px-2 py-2 text-center">$ Impact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-2 py-1.5"><AlertBadge category={a.category} /></td>
                <td className="px-2 py-1.5 font-medium">{a.physician}</td>
                <td className="px-2 py-1.5 text-gray-500 hidden sm:table-cell">{a.location}</td>
                <td className="px-2 py-1.5 text-center">{a.evalsOld}</td>
                <td className="px-2 py-1.5 text-center font-bold">{a.evalsNew}</td>
                <td className={`px-2 py-1.5 text-center font-medium ${(a.pctChange || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {a.pctChange !== null ? `${a.pctChange > 0 ? '+' : ''}${a.pctChange}%` : 'New'}
                </td>
                <td className={`px-2 py-1.5 text-center font-medium ${a.estRevImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {a.estRevImpact < 0 ? `-$${Math.abs(a.estRevImpact).toLocaleString()}` : `+$${a.estRevImpact.toLocaleString()}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {zeroVisitAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-bold text-red-600 mb-3">Zero-Visit Alerts ({ly})</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left">Physician</th>
                <th className="px-2 py-1.5 hidden sm:table-cell">Location</th>
                <th className="px-2 py-1.5 text-center">Evals</th>
                <th className="px-2 py-1.5">Issue</th>
                <th className="px-2 py-1.5 text-center">Est. Lost</th>
              </tr>
            </thead>
            <tbody>
              {zeroVisitAlerts.map((z, i) => (
                <tr key={i} className="bg-red-50/50 border-b border-red-100">
                  <td className="px-2 py-1 font-medium">{z.physician}</td>
                  <td className="px-2 py-1 text-center hidden sm:table-cell">{z.location}</td>
                  <td className="px-2 py-1 text-center font-bold">{z.evals}</td>
                  <td className="px-2 py-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${z.issue === 'Never Scheduled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {z.issue}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center text-red-600">${z.estLostRev.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
