'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Stat from '../shared/Stat'
import { O, G, R, BL, fmt } from '../shared/constants'
import type { AnnualKPI, LagAnalysisRow } from '@/lib/dataEngine'

export default function SpeedToCareTab({
  annualKPIs,
  lagAnalysis,
  years,
}: {
  annualKPIs: AnnualKPI[]
  lagAnalysis: LagAnalysisRow[]
  years: number[]
}) {
  return (
    <>
      {/* Summary stats per year */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {annualKPIs.map((a) => {
          const yrLag = lagAnalysis.filter((l) => l.year === a.year)
          const totalCases = yrLag.reduce((s, l) => s + l.caseCount, 0)
          const avgToEval = totalCases > 0
            ? Math.round(yrLag.reduce((s, l) => s + l.avgCreatedToEvalDays * l.caseCount, 0) / totalCases * 10) / 10
            : 0
          return (
            <Stat
              key={a.year}
              label={`${a.year} Avg Days to Eval`}
              value={`${avgToEval}`}
              sub="Referral → First Eval"
              color={avgToEval > 10 ? R : G}
            />
          )
        })}
      </div>

      {/* Per-year location breakdown */}
      {years.map((yr) => {
        const yrLag = lagAnalysis
          .filter((l) => l.year === yr)
          .sort((a, b) => b.avgCreatedToEvalDays - a.avgCreatedToEvalDays)

        return (
          <div key={yr} className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>{yr} Speed to Care by Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={Math.max(200, yrLag.length * 28)}>
                <BarChart data={yrLag} layout="vertical" margin={{ left: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} label={{ value: 'Days', position: 'insideBottom', fontSize: 10 }} />
                  <YAxis dataKey="location" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="avgCreatedToEvalDays" name="Referral → Eval" fill={O} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avgCreatedToSchedDays" name="Referral → Sched" fill={BL} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="text-xs self-start">
                <thead>
                  <tr style={{ backgroundColor: O }} className="text-white">
                    <th className="px-2 py-1.5 text-left">Location</th>
                    <th className="px-2 py-1.5 text-center">Ref→Sched</th>
                    <th className="px-2 py-1.5 text-center">Ref→Eval</th>
                    <th className="px-2 py-1.5 text-center">Sched→Arrive</th>
                    <th className="px-2 py-1.5 text-center">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {yrLag.map((l, i) => (
                    <tr key={i} className={l.avgCreatedToEvalDays > 14 ? 'bg-red-50' : i % 2 ? '' : 'bg-orange-50/40'}>
                      <td className="px-2 py-1 font-medium">{l.location}</td>
                      <td className="px-2 py-1 text-center">{l.avgCreatedToSchedDays}d</td>
                      <td className={`px-2 py-1 text-center font-medium ${l.avgCreatedToEvalDays > 14 ? 'text-red-600' : l.avgCreatedToEvalDays > 7 ? 'text-orange-600' : 'text-green-600'}`}>
                        {l.avgCreatedToEvalDays}d
                      </td>
                      <td className="px-2 py-1 text-center">{l.avgSchedToArriveDays}d</td>
                      <td className="px-2 py-1 text-center text-gray-500">{l.caseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
