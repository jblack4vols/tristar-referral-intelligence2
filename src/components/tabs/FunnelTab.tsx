'use client'

import { O } from '../shared/constants'
import type { FunnelRow } from '@/lib/dataEngine'

export default function FunnelTab({
  funnel,
  years,
}: {
  funnel: FunnelRow[]
  years: number[]
}) {
  return (
    <>
      {years.map((yr) => (
        <div key={yr} className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: O }}>{yr} Conversion Funnel</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left">Location</th>
                <th className="px-2 py-1.5 text-center">Created</th>
                <th className="px-2 py-1.5 text-center">Sched %</th>
                <th className="px-2 py-1.5 text-center">Arrive %</th>
                <th className="px-2 py-1.5 text-center">Eval %</th>
                <th className="px-2 py-1.5 text-center">DC %</th>
              </tr>
            </thead>
            <tbody>
              {funnel
                .filter((f) => f.year === yr)
                .sort((a, b) => a.arriveRate - b.arriveRate)
                .map((f, i) => (
                  <tr key={i} className={f.arriveRate < 70 ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1 font-medium">{f.location}</td>
                    <td className="px-2 py-1 text-center">{f.created}</td>
                    <td className="px-2 py-1 text-center">{f.schedRate}%</td>
                    <td
                      className={`px-2 py-1 text-center font-medium ${
                        f.arriveRate < 70 ? 'text-red-600' : f.arriveRate < 80 ? 'text-orange-600' : 'text-green-600'
                      }`}
                    >
                      {f.arriveRate}%
                    </td>
                    <td className="px-2 py-1 text-center">{f.evalRate}%</td>
                    <td className="px-2 py-1 text-center">{f.dcRate}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
