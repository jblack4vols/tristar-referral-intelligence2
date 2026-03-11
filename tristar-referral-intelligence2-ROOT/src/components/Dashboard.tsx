'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, CartesianGrid, AreaChart, Area, ComposedChart
} from 'recharts'
import {
  parseExcelFile, processData,
  type DataSet, type ProcessedData, type RawCase
} from '@/lib/dataEngine'
import {
  supabase, saveDataset, saveCases, saveProcessedKPIs,
  loadDatasets, loadCases, loadProcessedKPIs, deleteDataset
} from '@/lib/supabase'

const O = '#FF8200', P = '#FFEAD5', BK = '#000000', G = '#16A34A', R = '#DC2626', BL = '#2563EB'
const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`
const fmtN = (n: number) => n >= 1e3 ? n.toLocaleString() : String(n)

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4" style={{ borderLeftColor: color || O }}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: color || BK }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function AlertBadge({ category }: { category: string }) {
  const s: Record<string, string> = {
    'Gone Dark': 'bg-red-100 text-red-700', 'Sharp Decline': 'bg-orange-100 text-orange-700',
    'Moderate Decline': 'bg-yellow-100 text-yellow-700', 'Rising Star': 'bg-green-100 text-green-700',
    'New Relationship': 'bg-blue-100 text-blue-700',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s[category] || 'bg-gray-100 text-gray-600'}`}>{category}</span>
}

export default function Dashboard() {
  const [datasets, setDatasets] = useState<DataSet[]>([])
  const [data, setData] = useState<ProcessedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState('kpi')
  const [search, setSearch] = useState('')
  const [locFilter, setLocFilter] = useState('All')
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Load from Supabase on mount
  useEffect(() => {
    async function init() {
      setLoading(true)
      setStatus('Loading saved data...')
      try {
        // Try loading cached KPIs first
        const cached = await loadProcessedKPIs()
        const dbDatasets = await loadDatasets()

        if (cached && dbDatasets.length > 0) {
          // Reconstruct dataset labels
          const ds: DataSet[] = dbDatasets.map((d: any) => ({
            label: d.label,
            year: d.year,
            startDate: d.start_date || '',
            endDate: d.end_date || '',
            cases: [], // We don't need to reload all cases if we have cached KPIs
          }))
          setDatasets(ds)
          setData(cached as ProcessedData)
          setStatus('')
        } else if (dbDatasets.length > 0) {
          // Have datasets but no cached KPIs — recompute
          setStatus('Recomputing from saved data...')
          const allCases = await loadCases()
          const ds: DataSet[] = dbDatasets.map((d: any) => {
            const dCases = allCases
              .filter((c: any) => c.dataset_id === d.id)
              .map(dbCaseToRawCase)
            return {
              label: d.label, year: d.year,
              startDate: d.start_date || '', endDate: d.end_date || '',
              cases: dCases,
            }
          })
          setDatasets(ds)
          const processed = processData(ds)
          setData(processed)
          await saveProcessedKPIs(processed)
          setStatus('')
        } else {
          setStatus('')
        }
      } catch (err) {
        console.error('Init error:', err)
        setStatus('Error loading — start by uploading files')
      }
      setLoading(false)
    }
    init()
  }, [])

  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true)
    const newDs = [...datasets]

    for (const file of Array.from(files)) {
      if (!file.name.match(/\.xlsx?$/i)) continue
      setStatus(`Parsing ${file.name}...`)

      const buf = await file.arrayBuffer()
      const ds = parseExcelFile(buf, file.name)

      // Save to Supabase
      setStatus(`Saving ${ds.year} to database (${ds.cases.length} cases)...`)
      try {
        const dbDs = await saveDataset({
          year: ds.year, label: ds.label,
          startDate: ds.startDate, endDate: ds.endDate,
          fileName: file.name, caseCount: ds.cases.length,
        })
        await saveCases(dbDs.id, ds.cases)
      } catch (err) {
        console.error('Save error:', err)
        setStatus(`Error saving ${file.name} — processing locally`)
      }

      // Update local state
      const idx = newDs.findIndex(d => d.year === ds.year)
      if (idx >= 0) newDs[idx] = ds
      else newDs.push(ds)
    }

    newDs.sort((a, b) => a.year - b.year)
    setDatasets(newDs)

    setStatus('Computing analytics...')
    const processed = processData(newDs)
    setData(processed)

    // Cache processed KPIs
    try {
      await saveProcessedKPIs(processed)
    } catch (err) {
      console.error('Cache error:', err)
    }

    setStatus('')
    setUploading(false)
  }, [datasets])

  const removeDs = useCallback(async (year: number) => {
    try {
      await deleteDataset(year)
    } catch (err) { console.error(err) }

    const updated = datasets.filter(d => d.year !== year)
    setDatasets(updated)
    if (updated.length > 0) {
      const processed = processData(updated)
      setData(processed)
      try { await saveProcessedKPIs(processed) } catch { }
    } else {
      setData(null)
    }
  }, [datasets])

  const allLocations = useMemo(() => {
    if (!data) return ['All']
    return ['All', ...[...new Set(data.locationKPIs.map(l => l.location))].sort()]
  }, [data])

  const years = useMemo(() => data?.annualKPIs.map(a => a.year) || [], [data])

  // ============================================================
  // UPLOAD / LOADING SCREEN
  // ============================================================
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: O }}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: O }}>Tristar PT — Referral Intelligence</h1>
            <p className="text-sm text-gray-500 mb-6">Upload Created Cases Report files to begin</p>
          </div>

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-orange-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault() }}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          >
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-600">Drop .xlsx files here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Upload multiple years for trend analysis</p>
          </div>

          <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)} />

          {(loading || uploading) && (
            <div className="mt-4 text-center">
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full animate-pulse" style={{ backgroundColor: O, width: '60%' }} />
              </div>
              <p className="text-xs text-gray-500">{status || 'Processing...'}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">Data persists in Supabase — come back anytime</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  const { annualKPIs, monthlyKPIs, locationKPIs, physicianRankings, alerts, funnel, zeroVisitAlerts, otPTSplit } = data
  const ly = years[years.length - 1], py = years.length > 1 ? years[years.length - 2] : null
  const la = annualKPIs.find(a => a.year === ly), pa = py ? annualKPIs.find(a => a.year === py) : null
  const mf = monthlyKPIs.filter(m => m.totalCases >= 50)

  const TABS = [
    { id: 'kpi', label: 'KPI Trends' }, { id: 'revenue', label: 'Revenue' },
    { id: 'physicians', label: 'Physicians' }, { id: 'alerts', label: 'Alerts' },
    { id: 'funnel', label: 'Funnel' }, { id: 'otpt', label: 'OT vs PT' },
    { id: 'locations', label: 'Locations' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="text-white px-4 py-3" style={{ backgroundColor: BK }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold" style={{ color: O }}>TRISTAR PT — Referral Intelligence</h1>
            <p className="text-xs text-gray-400">{datasets.map(d => d.label).join(' · ')}</p>
          </div>
          <div className="flex items-center gap-2">
            {datasets.map(d => (
              <span key={d.year} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: '#333', color: O }}>
                {d.year}
                <button onClick={() => removeDs(d.year)} className="ml-0.5 hover:text-white text-gray-500">×</button>
              </span>
            ))}
            <button onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors">
              + Import Data
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
              onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
          </div>
        </div>
        {status && <div className="max-w-7xl mx-auto"><p className="text-xs text-orange-300 mt-1">{status}</p></div>}
      </div>

      {/* TAB NAV */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setLocFilter('All') }}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab === t.id ? { color: O, borderColor: O } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto p-4 space-y-4">

        {/* KPI TRENDS */}
        {tab === 'kpi' && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={`${ly} Total Cases`} value={fmtN(la?.totalCases || 0)} sub={pa ? `vs ${fmtN(pa.totalCases)} in ${py}` : ''} />
            <Stat label="Physician Referrals" value={fmtN(la?.physicianCases || 0)} sub={`${la?.physicianPct}% of total`} />
            <Stat label="Tier A %" value={`${la?.tierAPct}%`} sub={pa ? `vs ${pa.tierAPct}% in ${py}` : ''} color={G} />
            <Stat label="Weighted RPV" value={`$${la?.avgWeightedRPV}`} sub={pa ? `vs $${pa.avgWeightedRPV}` : ''} color={G} />
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Monthly Cases: Physician vs Non-Physician</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={3} angle={-45} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="physCases" name="Physician" stackId="1" fill={O} stroke={O} fillOpacity={0.7} />
                <Area type="monotone" dataKey="nonPhysCases" name="Non-Physician" stackId="1" fill={BK} stroke={BK} fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Tier A Payer %</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={mf}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={4} /><YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                  <Tooltip /><Line type="monotone" dataKey="tierAPct" stroke={G} strokeWidth={2} dot={{ r: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Arrival Rate %</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={mf}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={4} /><YAxis domain={[55, 90]} tick={{ fontSize: 10 }} />
                  <Tooltip /><Line type="monotone" dataKey="arriveRate" stroke={R} strokeWidth={2} dot={{ r: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Annual table */}
          <div className="bg-white rounded-lg p-4 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Annual Comparison</h3>
            <table className="w-full text-xs">
              <thead><tr style={{ backgroundColor: O }} className="text-white">
                <th className="px-2 py-1.5 text-left">KPI</th>
                {years.map(y => <th key={y} className="px-2 py-1.5 text-center">{y}</th>)}
              </tr></thead>
              <tbody>
                {[
                  { l: 'Total Cases', f: (a: any) => fmtN(a.totalCases) },
                  { l: 'Physician Cases', f: (a: any) => fmtN(a.physicianCases) },
                  { l: 'Non-Physician', f: (a: any) => fmtN(a.nonPhysicianCases) },
                  { l: 'Weighted Revenue', f: (a: any) => fmt(a.weightedRevenue) },
                  { l: 'Avg RPV', f: (a: any) => `$${a.avgWeightedRPV}` },
                  { l: 'Tier A %', f: (a: any) => `${a.tierAPct}%` },
                  { l: 'OT %', f: (a: any) => `${a.otPct}%` },
                  { l: 'Avg V/E', f: (a: any) => a.avgVE },
                  { l: 'Physicians', f: (a: any) => fmtN(a.uniquePhysicians) },
                ].map((r, i) => (
                  <tr key={i} className={i % 2 ? '' : 'bg-orange-50/40'}>
                    <td className="px-2 py-1 font-medium">{r.l}</td>
                    {years.map(y => { const a = annualKPIs.find(k => k.year === y); return <td key={y} className="px-2 py-1 text-center">{a ? r.f(a) : '—'}</td> })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* REVENUE */}
        {tab === 'revenue' && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {annualKPIs.map(a => <Stat key={a.year} label={`${a.year} Wt. Rev`} value={fmt(a.weightedRevenue)} sub={`RPV: $${a.avgWeightedRPV}`} />)}
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
        </>}

        {/* PHYSICIANS */}
        {tab === 'physicians' && <>
          <div className="flex gap-2 items-center flex-wrap">
            <input placeholder="Search physician, NPI..." value={search} onChange={e => setSearch(e.target.value)}
              className="max-w-xs text-xs px-3 py-1.5 border rounded-lg" />
            <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className="text-xs border rounded px-2 py-1.5 bg-white">
              {allLocations.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr style={{ backgroundColor: O }} className="text-white">
                <th className="px-2 py-1.5">#</th><th className="px-2 py-1.5 text-left">Physician</th><th className="px-2 py-1.5 text-left">Location</th>
                {years.map(y => <th key={y} className="px-2 py-1.5 text-center">{y}</th>)}
                <th className="px-2 py-1.5 text-center">Wt. Rev</th><th className="px-2 py-1.5 text-center">V/E</th>
                <th className="px-2 py-1.5 text-center">Tier A</th><th className="px-2 py-1.5 text-center">Trend</th>
              </tr></thead>
              <tbody>
                {physicianRankings
                  .filter(p => {
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
                      {years.map(y => <td key={y} className="px-2 py-1 text-center">{p.yearData[y]?.evals || 0}</td>)}
                      <td className="px-2 py-1 text-center font-bold">{fmt(p.weightedRev)}</td>
                      <td className="px-2 py-1 text-center">{p.avgVE}</td>
                      <td className="px-2 py-1 text-center">{p.tierAPct}%</td>
                      <td className="px-2 py-1 text-center">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${p.trend === 'Declining' ? 'bg-red-100 text-red-700' : p.trend === 'Growing' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.trend}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* ALERTS */}
        {tab === 'alerts' && <>
          {alerts.length === 0 ? <div className="bg-white rounded-lg p-8 text-center text-gray-400 shadow-sm">Need 2+ years for alerts.</div> : <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {['Gone Dark', 'Sharp Decline', 'Moderate Decline', 'Rising Star', 'New Relationship'].map(cat => {
                const n = alerts.filter(a => a.category === cat).length
                const cl: Record<string, string> = { 'Gone Dark': R, 'Sharp Decline': '#F97316', 'Moderate Decline': '#EAB308', 'Rising Star': G, 'New Relationship': BL }
                return <Stat key={cat} label={cat} value={String(n)} color={cl[cat]} />
              })}
            </div>
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="px-2 py-2 text-left">Category</th><th className="px-2 py-2 text-left">Physician</th>
                  <th className="px-2 py-2 text-left">Location</th><th className="px-2 py-2 text-center">{py}</th>
                  <th className="px-2 py-2 text-center">{ly}</th><th className="px-2 py-2 text-center">Δ%</th>
                  <th className="px-2 py-2 text-center">$ Impact</th>
                </tr></thead>
                <tbody>
                  {alerts.filter(a => {
                    if (search && !a.physician.toLowerCase().includes(search.toLowerCase())) return false
                    if (locFilter !== 'All' && a.location !== locFilter) return false
                    return true
                  }).map((a, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1.5"><AlertBadge category={a.category} /></td>
                      <td className="px-2 py-1.5 font-medium">{a.physician}</td>
                      <td className="px-2 py-1.5 text-gray-500">{a.location}</td>
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
                <h3 className="text-sm font-bold text-red-600 mb-3">⚠ Zero-Visit Alerts ({ly})</h3>
                <table className="w-full text-xs">
                  <thead><tr className="border-b"><th className="px-2 py-1.5 text-left">Physician</th><th className="px-2 py-1.5">Location</th>
                    <th className="px-2 py-1.5 text-center">Evals</th><th className="px-2 py-1.5">Issue</th><th className="px-2 py-1.5 text-center">Est. Lost</th></tr></thead>
                  <tbody>{zeroVisitAlerts.map((z, i) => (
                    <tr key={i} className="bg-red-50/50 border-b border-red-100">
                      <td className="px-2 py-1 font-medium">{z.physician}</td>
                      <td className="px-2 py-1 text-center">{z.location}</td>
                      <td className="px-2 py-1 text-center font-bold">{z.evals}</td>
                      <td className="px-2 py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${z.issue === 'Never Scheduled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{z.issue}</span></td>
                      <td className="px-2 py-1 text-center text-red-600">${z.estLostRev.toLocaleString()}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>}
        </>}

        {/* FUNNEL */}
        {tab === 'funnel' && <>
          {years.map(yr => (
            <div key={yr} className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-bold mb-2" style={{ color: O }}>{yr} Conversion Funnel</h3>
              <table className="w-full text-xs">
                <thead><tr className="border-b"><th className="px-2 py-1.5 text-left">Location</th><th className="px-2 py-1.5 text-center">Created</th>
                  <th className="px-2 py-1.5 text-center">Sched %</th><th className="px-2 py-1.5 text-center">Arrive %</th>
                  <th className="px-2 py-1.5 text-center">Eval %</th><th className="px-2 py-1.5 text-center">DC %</th></tr></thead>
                <tbody>{funnel.filter(f => f.year === yr).sort((a, b) => a.arriveRate - b.arriveRate).map((f, i) => (
                  <tr key={i} className={f.arriveRate < 70 ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1 font-medium">{f.location}</td><td className="px-2 py-1 text-center">{f.created}</td>
                    <td className="px-2 py-1 text-center">{f.schedRate}%</td>
                    <td className={`px-2 py-1 text-center font-medium ${f.arriveRate < 70 ? 'text-red-600' : f.arriveRate < 80 ? 'text-orange-600' : 'text-green-600'}`}>{f.arriveRate}%</td>
                    <td className="px-2 py-1 text-center">{f.evalRate}%</td><td className="px-2 py-1 text-center">{f.dcRate}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </>}

        {/* OT vs PT */}
        {tab === 'otpt' && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {annualKPIs.map(a => <Stat key={a.year} label={`${a.year} OT`} value={fmtN(a.otCases)} sub={`${a.otPct}%`} color={a.otPct > 15 ? G : O} />)}
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>Monthly OT %</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mf}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 8 }} interval={3} angle={-45} textAnchor="end" height={40} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip /><Area type="monotone" dataKey="otPct" name="OT %" fill={BL} stroke={BL} fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {py && <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>OT by Location ({py})</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={otPTSplit.filter(o => o.year === py && o.otPct > 0).sort((a, b) => b.otPct - a.otPct)} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis dataKey="location" type="category" tick={{ fontSize: 11 }} width={90} /><Tooltip />
                <Bar dataKey="otPct" name="OT %" fill={BL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </>}

        {/* LOCATIONS */}
        {tab === 'locations' && <>
          {py && <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>{py} Revenue by Location</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={locationKPIs.filter(l => l.year === py).sort((a, b) => b.weightedRev - a.weightedRev)} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 9 }} />
                <YAxis dataKey="location" type="category" tick={{ fontSize: 11 }} width={90} /><Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="weightedRev" name="Revenue" fill={O} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto p-4">
            <h3 className="text-sm font-bold mb-2" style={{ color: O }}>All Location KPIs</h3>
            <table className="w-full text-xs">
              <thead><tr style={{ backgroundColor: O }} className="text-white">
                <th className="px-2 py-1.5 text-left">Location</th><th className="px-2 py-1.5 text-center">Year</th>
                <th className="px-2 py-1.5 text-center">Cases</th><th className="px-2 py-1.5 text-center">Visits</th>
                <th className="px-2 py-1.5 text-center">Wt. Rev</th><th className="px-2 py-1.5 text-center">RPV</th>
                <th className="px-2 py-1.5 text-center">V/E</th><th className="px-2 py-1.5 text-center">Arrive %</th>
                <th className="px-2 py-1.5 text-center">OT %</th><th className="px-2 py-1.5 text-center">Physicians</th>
              </tr></thead>
              <tbody>{locationKPIs.sort((a, b) => a.location.localeCompare(b.location) || a.year - b.year).map((l, i) => (
                <tr key={i} className={i % 2 ? 'bg-orange-50/30' : ''}>
                  <td className="px-2 py-1 font-medium">{l.location}</td><td className="px-2 py-1 text-center">{l.year}</td>
                  <td className="px-2 py-1 text-center">{fmtN(l.totalCases)}</td><td className="px-2 py-1 text-center">{fmtN(l.totalVisits)}</td>
                  <td className="px-2 py-1 text-center font-bold">{fmt(l.weightedRev)}</td><td className="px-2 py-1 text-center">${l.avgRPV}</td>
                  <td className="px-2 py-1 text-center">{l.avgVE}</td>
                  <td className={`px-2 py-1 text-center ${l.arriveRate < 70 ? 'text-red-600 font-medium' : ''}`}>{l.arriveRate}%</td>
                  <td className="px-2 py-1 text-center">{l.otPct}%</td><td className="px-2 py-1 text-center">{l.uniquePhysicians}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

      </div>
    </div>
  )
}

// Convert DB row back to RawCase format for reprocessing
function dbCaseToRawCase(c: any): RawCase {
  return {
    patientAccountNumber: c.patient_account_number || '',
    patientName: c.patient_name || '',
    caseTherapist: c.case_therapist || '',
    caseFacility: c.case_facility || '',
    referringDoctor: c.referring_doctor || '',
    referringDoctorNPI: c.referring_doctor_npi || '',
    referralSource: c.referral_source || '',
    primaryPayerType: c.primary_payer_type || '',
    primaryInsurance: c.primary_insurance || '',
    arrivedVisits: c.arrived_visits || 0,
    scheduledVisits: c.scheduled_visits || 0,
    createdDate: c.created_date ? new Date(c.created_date) : null,
    dateOfInitialEval: c.date_of_initial_eval ? new Date(c.date_of_initial_eval) : null,
    dischargeDate: c.discharge_date ? new Date(c.discharge_date) : null,
    dateOfFirstScheduledVisit: c.date_of_first_scheduled_visit ? new Date(c.date_of_first_scheduled_visit) : null,
    dateOfFirstArrivedVisit: c.date_of_first_arrived_visit ? new Date(c.date_of_first_arrived_visit) : null,
    discipline: c.discipline || '',
    dischargeReason: c.discharge_reason || '',
    year: c.year || 0,
    isPhysician: c.is_physician || false,
    isUHC: c.is_uhc || false,
  }
}
