'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { O, fmt, fmtN } from '../shared/constants'
import type { PayerMixRow } from '@/lib/dataEngine'

export default function PayerMixTab({
  payerMix,
  years,
}: {
  payerMix: PayerMixRow[]
  years: number[]
}) {
  return (
    <>
      {years.map((yr) => {
        const yrMix = payerMix.filter((p) => p.year === yr).sort((a, b) => b.count - a.count)
        return (
          <div key={yr} className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-bold mb-3" style={{ color: O }}>{yr} Payer Mix — Physician Referrals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={yrMix.slice(0, 8)} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="payerType" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="pct" name="% of Cases" fill={O} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="text-xs self-start">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left">Payer Type</th>
                    <th className="px-2 py-1.5 text-center">Cases</th>
                    <th className="px-2 py-1.5 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {yrMix.map((p, i) => (
                    <tr key={i} className={i % 2 ? '' : 'bg-orange-50/40'}>
                      <td className="px-2 py-1 font-medium">{p.payerType}</td>
                      <td className="px-2 py-1 text-center">{fmtN(p.count)}</td>
                      <td className="px-2 py-1 text-center font-medium">{p.pct}%</td>
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
