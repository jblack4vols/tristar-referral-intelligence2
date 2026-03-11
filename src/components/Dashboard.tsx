'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  parseExcelFile, processData,
  type DataSet, type ProcessedData, type RawCase,
} from '@/lib/dataEngine'
import {
  saveDataset, saveCases, saveProcessedKPIs,
  loadDatasets, loadCases, loadProcessedKPIs, deleteDataset,
} from '@/lib/supabase'
import UploadScreen from './shared/UploadScreen'
import Header from './shared/Header'
import TabNav from './shared/TabNav'
import ErrorToast from './shared/ErrorToast'
import KPITab from './tabs/KPITab'
import RevenueTab from './tabs/RevenueTab'
import PhysiciansTab from './tabs/PhysiciansTab'
import AlertsTab from './tabs/AlertsTab'
import FunnelTab from './tabs/FunnelTab'
import OTPTTab from './tabs/OTPTTab'
import LocationsTab from './tabs/LocationsTab'

export default function Dashboard() {
  const [datasets, setDatasets] = useState<DataSet[]>([])
  const [data, setData] = useState<ProcessedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState('kpi')
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showError = useCallback((msg: string) => {
    console.error(msg)
    setError(msg)
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
          const ds: DataSet[] = dbDatasets.map((d: any) => ({
            label: d.label,
            year: d.year,
            startDate: d.start_date || '',
            endDate: d.end_date || '',
            cases: [],
          }))
          setDatasets(ds)
          setData(cached as ProcessedData)
          setStatus('')
        } else if (dbDatasets.length > 0) {
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

    try {
      await saveProcessedKPIs(processed)
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
      try { await saveProcessedKPIs(processed) } catch { /* best-effort */ }
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
      <TabNav tab={tab} onTabChange={(id) => { setTab(id) }} />

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {tab === 'kpi' && <KPITab annualKPIs={annualKPIs} monthlyKPIs={monthlyKPIs} years={years} />}
        {tab === 'revenue' && <RevenueTab annualKPIs={annualKPIs} monthlyKPIs={monthlyKPIs} />}
        {tab === 'physicians' && <PhysiciansTab physicianRankings={physicianRankings} years={years} allLocations={allLocations} />}
        {tab === 'alerts' && <AlertsTab alerts={alerts} zeroVisitAlerts={zeroVisitAlerts} years={years} allLocations={allLocations} />}
        {tab === 'funnel' && <FunnelTab funnel={funnel} years={years} />}
        {tab === 'otpt' && <OTPTTab annualKPIs={annualKPIs} monthlyKPIs={monthlyKPIs} otPTSplit={otPTSplit} years={years} />}
        {tab === 'locations' && <LocationsTab locationKPIs={locationKPIs} years={years} />}
      </div>

      {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
    </div>
  )
}

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
