'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  parseExcelFile, processData,
  type DataSet, type ProcessedData,
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
      </div>

      {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
    </div>
  )
}
