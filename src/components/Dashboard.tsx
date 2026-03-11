'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  parseExcelFile, processData,
  type DataSet, type ProcessedData,
  type DataSet, type ProcessedData, type RawCase, type PhysicianRanking
} from '@/lib/dataEngine'
import {
  saveDataset, saveCases, saveProcessedKPIs,
  loadDatasets, loadCases, loadProcessedKPIs, deleteDataset, dbCaseToRawCase,
} from '@/lib/supabase'
import UploadScreen from './shared/UploadScreen'
import Header from './shared/Header'
import TabNav from './shared/TabNav'
import ErrorToast from './shared/ErrorToast'
import { TabSkeleton } from './shared/Skeleton'
import { TABS } from './shared/constants'
import SummaryTab from './tabs/SummaryTab'
import KPITab from './tabs/KPITab'
import RevenueTab from './tabs/RevenueTab'
import PhysiciansTab from './tabs/PhysiciansTab'
import AlertsTab from './tabs/AlertsTab'
import FunnelTab from './tabs/FunnelTab'
import OTPTTab from './tabs/OTPTTab'
import LocationsTab from './tabs/LocationsTab'

const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const VALID_TAB_IDS = new Set(TABS.map((t) => t.id))

const O = '#FF8200', P = '#FFEAD5', BK = '#000000', G = '#16A34A', R = '#DC2626', BL = '#2563EB', PU = '#7C3AED'
const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`
const fmtN = (n: number) => n >= 1e3 ? n.toLocaleString() : String(n)

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const escape = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function Delta({ current, previous, suffix = '', invert = false }: { current: number; previous: number | null; suffix?: string; invert?: boolean }) {
  if (previous === null || previous === undefined) return null
  const diff = current - previous
  if (diff === 0) return <span className="text-xs text-gray-400 ml-1">—</span>
  const positive = invert ? diff < 0 : diff > 0
  return (
    <span className={`text-xs ml-1 font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()}{suffix}
    </span>
  )
}

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
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') || 'summary'

  const [datasets, setDatasets] = useState<DataSet[]>([])
  const [data, setData] = useState<ProcessedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState(VALID_TAB_IDS.has(initialTab) ? initialTab : 'summary')
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [physSort, setPhysSort] = useState<{ key: keyof PhysicianRanking | 'latestEvals'; dir: 'asc' | 'desc' }>({ key: 'weightedRev', dir: 'desc' })
  const [alertSearch, setAlertSearch] = useState('')
  const [alertCatFilter, setAlertCatFilter] = useState('All')
  const fileRef = useRef<HTMLInputElement>(null)
  const dataRef = useRef<ProcessedData | null>(null)
  const dirtyRef = useRef(false)

  // Keep dataRef in sync
  useEffect(() => { dataRef.current = data }, [data])

  const showError = useCallback((msg: string) => {
    console.error(msg)
    setError(msg)
  }, [])

  // URL-based tab routing
  const handleTabChange = useCallback((id: string) => {
    setTab(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  // Autosave: periodically save processed KPIs to Supabase
  useEffect(() => {
    const interval = setInterval(async () => {
      if (dirtyRef.current && dataRef.current) {
        try {
          await saveProcessedKPIs(dataRef.current)
          dirtyRef.current = false
          setLastSaved(new Date())
        } catch {
          // Silent — autosave is best-effort
        }
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Load from Supabase on mount
  useEffect(() => {
    async function init() {
      setLoading(true)
      setStatus('Loading saved data...')
      try {
        const cached = await loadProcessedKPIs()
        const dbDatasets = await loadDatasets()

        if (cached && dbDatasets.length > 0) {
          const ds: DataSet[] = dbDatasets.map((d) => ({
            label: d.label,
            year: d.year,
            startDate: d.start_date || '',
            endDate: d.end_date || '',
            cases: [],
          }))
          setDatasets(ds)
          setData(cached)
          setStatus('')
        } else if (dbDatasets.length > 0) {
          setStatus('Recomputing from saved data...')
          const allCases = await loadCases()
          const ds: DataSet[] = dbDatasets.map((d) => {
            const dCases = allCases
              .filter((c) => c.dataset_id === d.id)
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
          setLastSaved(new Date())
          setStatus('')
        } else {
          setStatus('')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        showError(`Failed to load saved data: ${msg}. Upload files to start fresh.`)
        setStatus('')
      }
      setLoading(false)
    }
    init()
  }, [showError])

  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true)
    const newDs = [...datasets]

    for (const file of Array.from(files)) {
      if (!file.name.match(/\.xlsx?$/i)) continue
      setStatus(`Parsing ${file.name}...`)

      let ds: DataSet
      try {
        const buf = await file.arrayBuffer()
        ds = parseExcelFile(buf, file.name)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        showError(`Failed to parse ${file.name}: ${msg}`)
        continue
      }

      setStatus(`Saving ${ds.year} to database (${ds.cases.length} cases)...`)
      try {
        const dbDs = await saveDataset({
          year: ds.year, label: ds.label,
          startDate: ds.startDate, endDate: ds.endDate,
          fileName: file.name, caseCount: ds.cases.length,
        })
        await saveCases(dbDs.id, ds.cases)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        showError(`Failed to save ${file.name} to database: ${msg}. Data processed locally only.`)
      }

      const idx = newDs.findIndex(d => d.year === ds.year)
      if (idx >= 0) newDs[idx] = ds
      else newDs.push(ds)
    }

    newDs.sort((a, b) => a.year - b.year)
    setDatasets(newDs)

    setStatus('Computing analytics...')
    const processed = processData(newDs)
    setData(processed)
    dirtyRef.current = true

    try {
      await saveProcessedKPIs(processed)
      dirtyRef.current = false
      setLastSaved(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showError(`Failed to cache analytics: ${msg}`)
    }

    setStatus('')
    setUploading(false)
  }, [datasets, showError])

  const removeDs = useCallback(async (year: number) => {
    try {
      await deleteDataset(year)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showError(`Failed to delete ${year} from database: ${msg}`)
    }

    const updated = datasets.filter(d => d.year !== year)
    setDatasets(updated)
    if (updated.length > 0) {
      const processed = processData(updated)
      setData(processed)
      dirtyRef.current = true
      try {
        await saveProcessedKPIs(processed)
        dirtyRef.current = false
        setLastSaved(new Date())
      } catch { /* best-effort */ }
    } else {
      setData(null)
    }
  }, [datasets, showError])

  const allLocations = useMemo(() => {
    if (!data) return ['All']
    return ['All', ...[...new Set(data.locationKPIs.map(l => l.location))].sort()]
  }, [data])

  const years = useMemo(() => data?.annualKPIs.map(a => a.year) || [], [data])

  // Upload / loading screen
  if (!data) {
    return (
      <>
        <UploadScreen
          fileRef={fileRef}
          loading={loading}
          uploading={uploading}
          status={status}
          onFiles={handleFiles}
        />
        {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
      </>
    )
  }

  const { annualKPIs, monthlyKPIs, locationKPIs, physicianRankings, alerts, funnel, zeroVisitAlerts, otPTSplit } = data
  // ============================================================
  // DASHBOARD
  // ============================================================
  const { annualKPIs, monthlyKPIs, locationKPIs, physicianRankings, alerts, funnel, zeroVisitAlerts, otPTSplit, payerMix, lagAnalysis } = data
  const ly = years[years.length - 1], py = years.length > 1 ? years[years.length - 2] : null
  const la = annualKPIs.find(a => a.year === ly), pa = py ? annualKPIs.find(a => a.year === py) : null
  const mf = monthlyKPIs.filter(m => m.totalCases >= 50)

  const TABS = [
    { id: 'kpi', label: 'KPI Trends' }, { id: 'revenue', label: 'Revenue' },
    { id: 'physicians', label: 'Physicians' }, { id: 'alerts', label: 'Alerts' },
    { id: 'funnel', label: 'Funnel' }, { id: 'otpt', label: 'OT vs PT' },
    { id: 'payer', label: 'Payer Mix' }, { id: 'lag', label: 'Speed to Care' },
    { id: 'locations', label: 'Locations' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        datasets={datasets}
        status={status}
        fileRef={fileRef}
        onRemoveDs={removeDs}
        onFiles={handleFiles}
      />
      <TabNav tab={tab} onTabChange={handleTabChange} />

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Autosave indicator */}
        {lastSaved && (
          <div className="text-right">
            <span className="text-[10px] text-gray-400">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          </div>
        )}

        {loading ? (
          <TabSkeleton />
        ) : (
          <>
            {tab === 'summary' && (
              <SummaryTab
                annualKPIs={annualKPIs}
                alerts={alerts}
                zeroVisitAlerts={zeroVisitAlerts}
                locationKPIs={locationKPIs}
                physicianRankings={physicianRankings}
                years={years}
              />
            )}
            {tab === 'kpi' && <KPITab annualKPIs={annualKPIs} monthlyKPIs={monthlyKPIs} years={years} />}
            {tab === 'revenue' && <RevenueTab annualKPIs={annualKPIs} monthlyKPIs={monthlyKPIs} />}
            {tab === 'physicians' && <PhysiciansTab physicianRankings={physicianRankings} years={years} allLocations={allLocations} />}
            {tab === 'alerts' && <AlertsTab alerts={alerts} zeroVisitAlerts={zeroVisitAlerts} years={years} allLocations={allLocations} />}
            {tab === 'funnel' && <FunnelTab funnel={funnel} years={years} />}
            {tab === 'otpt' && <OTPTTab annualKPIs={annualKPIs} monthlyKPIs={monthlyKPIs} otPTSplit={otPTSplit} years={years} />}
            {tab === 'locations' && <LocationsTab locationKPIs={locationKPIs} years={years} />}
          </>
        )}

        {/* KPI TRENDS */}
        {tab === 'kpi' && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 shadow-sm border-l-4" style={{ borderLeftColor: O }}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{ly} Total Cases</p>
              <p className="text-xl font-bold mt-0.5">{fmtN(la?.totalCases || 0)}
                <Delta current={la?.totalCases || 0} previous={pa?.totalCases ?? null} />
              </p>
              {pa && <p className="text-xs text-gray-400 mt-0.5">vs {fmtN(pa.totalCases)} in {py}</p>}
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm border-l-4" style={{ borderLeftColor: O }}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Physician Referrals</p>
              <p className="text-xl font-bold mt-0.5">{fmtN(la?.physicianCases || 0)}
                <Delta current={la?.physicianCases || 0} previous={pa?.physicianCases ?? null} />
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{la?.physicianPct}% of total</p>
            </div>
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
        {tab === 'physicians' && (() => {
          const filteredPhys = physicianRankings
            .filter(p => {
              if (search && !p.physician.toLowerCase().includes(search.toLowerCase()) && !p.npi.includes(search)) return false
              if (locFilter !== 'All' && p.location !== locFilter) return false
              return true
            })
            .sort((a, b) => {
              const { key, dir } = physSort
              let av: number, bv: number
              if (key === 'latestEvals') {
                av = a.yearData[ly]?.evals || 0; bv = b.yearData[ly]?.evals || 0
              } else {
                av = (a as any)[key] ?? 0; bv = (b as any)[key] ?? 0
              }
              return dir === 'desc' ? bv - av : av - bv
            })
          const sortHeader = (label: string, key: typeof physSort.key) => (
            <th className="px-2 py-1.5 text-center cursor-pointer select-none hover:text-orange-200"
              onClick={() => setPhysSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })}>
              {label} {physSort.key === key ? (physSort.dir === 'desc' ? '▼' : '▲') : ''}
            </th>
          )
          return <>
            <div className="flex gap-2 items-center flex-wrap">
              <input placeholder="Search physician, NPI..." value={search} onChange={e => setSearch(e.target.value)}
                className="max-w-xs text-xs px-3 py-1.5 border rounded-lg" />
              <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className="text-xs border rounded px-2 py-1.5 bg-white">
                {allLocations.map(l => <option key={l}>{l}</option>)}
              </select>
              <button onClick={() => exportCSV(
                ['#', 'Physician', 'NPI', 'Location', ...years.map(String), 'Wt. Rev', 'V/E', 'Tier A %', 'Trend'],
                filteredPhys.slice(0, 500).map((p, i) => [
                  String(i + 1), p.physician, p.npi, p.location,
                  ...years.map(y => String(p.yearData[y]?.evals || 0)),
                  String(p.weightedRev), String(p.avgVE), `${p.tierAPct}%`, p.trend
                ]),
                `physicians_${ly}.csv`
              )} className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 ml-auto">
                Export CSV
              </button>
            </div>
            <p className="text-[10px] text-gray-400">{filteredPhys.length} physicians found — showing top 100. Click column headers to sort.</p>
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr style={{ backgroundColor: O }} className="text-white">
                  <th className="px-2 py-1.5">#</th><th className="px-2 py-1.5 text-left">Physician</th><th className="px-2 py-1.5 text-left">Location</th>
                  {years.map(y => y === ly
                    ? <th key={y} className="px-2 py-1.5 text-center cursor-pointer select-none hover:text-orange-200"
                        onClick={() => setPhysSort(prev => prev.key === 'latestEvals' ? { key: 'latestEvals', dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: 'latestEvals', dir: 'desc' })}>
                        {y} {physSort.key === 'latestEvals' ? (physSort.dir === 'desc' ? '▼' : '▲') : ''}
                      </th>
                    : <th key={y} className="px-2 py-1.5 text-center">{y}</th>
                  )}
                  {sortHeader('Wt. Rev', 'weightedRev')}
                  {sortHeader('V/E', 'avgVE')}
                  {sortHeader('Tier A', 'tierAPct')}
                  <th className="px-2 py-1.5 text-center">Trend</th>
                </tr></thead>
                <tbody>
                  {filteredPhys
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
          </>
        })()}

        {/* ALERTS */}
        {tab === 'alerts' && (() => {
          const filteredAlerts = alerts.filter(a => {
            if (alertSearch && !a.physician.toLowerCase().includes(alertSearch.toLowerCase()) && !a.npi.includes(alertSearch)) return false
            if (locFilter !== 'All' && a.location !== locFilter) return false
            if (alertCatFilter !== 'All' && a.category !== alertCatFilter) return false
            return true
          })
          const totalLostRev = filteredAlerts.filter(a => a.estRevImpact < 0).reduce((s, a) => s + a.estRevImpact, 0)
          const totalGainedRev = filteredAlerts.filter(a => a.estRevImpact > 0).reduce((s, a) => s + a.estRevImpact, 0)
          return <>
          {alerts.length === 0 ? <div className="bg-white rounded-lg p-8 text-center text-gray-400 shadow-sm">Need 2+ years for alerts.</div> : <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {['Gone Dark', 'Sharp Decline', 'Moderate Decline', 'Rising Star', 'New Relationship'].map(cat => {
                const n = alerts.filter(a => a.category === cat).length
                const cl: Record<string, string> = { 'Gone Dark': R, 'Sharp Decline': '#F97316', 'Moderate Decline': '#EAB308', 'Rising Star': G, 'New Relationship': BL }
                return <Stat key={cat} label={cat} value={String(n)} color={cl[cat]} />
              })}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input placeholder="Search physician, NPI..." value={alertSearch} onChange={e => setAlertSearch(e.target.value)}
                className="max-w-xs text-xs px-3 py-1.5 border rounded-lg" />
              <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className="text-xs border rounded px-2 py-1.5 bg-white">
                {allLocations.map(l => <option key={l}>{l}</option>)}
              </select>
              <select value={alertCatFilter} onChange={e => setAlertCatFilter(e.target.value)} className="text-xs border rounded px-2 py-1.5 bg-white">
                <option>All</option>
                {['Gone Dark', 'Sharp Decline', 'Moderate Decline', 'Rising Star', 'New Relationship'].map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="ml-auto flex gap-3 items-center">
                <span className="text-xs text-red-600 font-medium">At Risk: {fmt(Math.abs(totalLostRev))}</span>
                <span className="text-xs text-green-600 font-medium">Gained: {fmt(totalGainedRev)}</span>
                <button onClick={() => exportCSV(
                  ['Category', 'Physician', 'NPI', 'Location', `${py} Evals`, `${ly} Evals`, 'Δ%', '$ Impact'],
                  filteredAlerts.map(a => [
                    a.category, a.physician, a.npi, a.location,
                    String(a.evalsOld), String(a.evalsNew),
                    a.pctChange !== null ? `${a.pctChange}%` : 'New',
                    String(a.estRevImpact)
                  ]),
                  `alerts_${ly}.csv`
                )} className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                  Export CSV
                </button>
              </div>
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
                  {filteredAlerts.map((a, i) => (
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
        </>
        })()}

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

        {/* PAYER MIX */}
        {tab === 'payer' && <>
          {years.map(yr => {
            const yrMix = payerMix?.filter(p => p.year === yr).sort((a, b) => b.count - a.count) || []
            const PAYER_COLORS: Record<string, string> = {
              'Blue Cross/Blue Shield': '#2563EB', 'Medicare Part B': '#16A34A',
              'Commercial Insurance Co.': O, 'Health Maintenance Organization (HMO) Medicare Risk': '#7C3AED',
              'Medicaid': '#DC2626', "Workers' Compensation Health Claim": '#F59E0B',
              'Self Pay': '#6B7280', 'Veterans Affairs Plan': '#0891B2',
            }
            return (
              <div key={yr} className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-bold mb-3" style={{ color: O }}>{yr} Payer Mix — Physician Referrals</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={yrMix.slice(0, 8)} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
                      <YAxis dataKey="payerType" type="category" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Bar dataKey="pct" name="% of Cases" fill={O} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <table className="text-xs self-start">
                    <thead><tr className="border-b"><th className="px-2 py-1.5 text-left">Payer Type</th>
                      <th className="px-2 py-1.5 text-center">Cases</th><th className="px-2 py-1.5 text-center">%</th></tr></thead>
                    <tbody>{yrMix.map((p, i) => (
                      <tr key={i} className={i % 2 ? '' : 'bg-orange-50/40'}>
                        <td className="px-2 py-1 font-medium">{p.payerType}</td>
                        <td className="px-2 py-1 text-center">{fmtN(p.count)}</td>
                        <td className="px-2 py-1 text-center font-medium">{p.pct}%</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </>}

        {/* SPEED TO CARE (LAG ANALYSIS) */}
        {tab === 'lag' && <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {annualKPIs.map(a => {
              const yrLag = lagAnalysis?.filter(l => l.year === a.year) || []
              const avgToEval = yrLag.length > 0
                ? Math.round(yrLag.reduce((s, l) => s + l.avgCreatedToEvalDays * l.caseCount, 0) / yrLag.reduce((s, l) => s + l.caseCount, 0) * 10) / 10
                : 0
              return <Stat key={a.year} label={`${a.year} Avg Days to Eval`} value={`${avgToEval}`} sub="Referral → First Eval" color={avgToEval > 10 ? R : G} />
            })}
          </div>
          {years.map(yr => {
            const yrLag = (lagAnalysis?.filter(l => l.year === yr) || []).sort((a, b) => b.avgCreatedToEvalDays - a.avgCreatedToEvalDays)
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
                    <thead><tr style={{ backgroundColor: O }} className="text-white">
                      <th className="px-2 py-1.5 text-left">Location</th>
                      <th className="px-2 py-1.5 text-center">Ref→Sched</th>
                      <th className="px-2 py-1.5 text-center">Ref→Eval</th>
                      <th className="px-2 py-1.5 text-center">Sched→Arrive</th>
                      <th className="px-2 py-1.5 text-center">Cases</th>
                    </tr></thead>
                    <tbody>{yrLag.map((l, i) => (
                      <tr key={i} className={l.avgCreatedToEvalDays > 14 ? 'bg-red-50' : i % 2 ? '' : 'bg-orange-50/40'}>
                        <td className="px-2 py-1 font-medium">{l.location}</td>
                        <td className="px-2 py-1 text-center">{l.avgCreatedToSchedDays}d</td>
                        <td className={`px-2 py-1 text-center font-medium ${l.avgCreatedToEvalDays > 14 ? 'text-red-600' : l.avgCreatedToEvalDays > 7 ? 'text-orange-600' : 'text-green-600'}`}>{l.avgCreatedToEvalDays}d</td>
                        <td className="px-2 py-1 text-center">{l.avgSchedToArriveDays}d</td>
                        <td className="px-2 py-1 text-center text-gray-500">{l.caseCount}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )
          })}
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

      {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
    </div>
  )
}
