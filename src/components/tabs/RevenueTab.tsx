'use client'

import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Line, Legend, CartesianGrid, Bar, ComposedChart,
} from 'recharts'
import Stat from '../shared/Stat'
import { O, BK, fmt } from '../shared/constants'
import type { AnnualKPI, MonthlyKPI } from '@/lib/dataEngine'

export default function RevenueTab({
  annualKPIs,
  monthlyKPIs,
}: {
  annualKPIs: AnnualKPI[]
  monthlyKPIs: MonthlyKPI[]
}) {
  const mf = monthlyKPIs.filter((m) => m.totalCases >= 50)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {annualKPIs.map((a) => (
          <Stat key={a.year} label={`${a.year} Wt. Rev`} value={fmt(a.weightedRevenue)} sub={`RPV: $${a.avgWeightedRPV}`} />
        ))}
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Monthly Revenue + RPV</h3>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={mf}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={3} angle={-45} textAnchor="end" height={40} />
            <YAxis yAxisId="rev" tick={{ fontSize: 9 }} tickFormatter={(v: number) => fmt(v)} />
            <YAxis yAxisId="rpv" orientation="right" domain={[85, 105]} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `$${v}`} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="rev" dataKey="weightedRev" name="Revenue" fill={O} radius={[2, 2, 0, 0]} />
            <Line yAxisId="rpv" type="monotone" dataKey="avgRPV" name="RPV" stroke={BK} strokeWidth={2} dot={{ r: 1.5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
