'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useDataLoader } from '@/hooks/use-data-loader'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useAutosave } from '@/hooks/use-autosave'
import LoginScreen from './shared/LoginScreen'
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
import PayerMixTab from './tabs/PayerMixTab'
import SpeedToCareTab from './tabs/SpeedToCareTab'
import LocationsTab from './tabs/LocationsTab'

const VALID_TAB_IDS = new Set(TABS.map((t) => t.id))

export default function Dashboard() {
  const { user, loading: authLoading, signIn, signOut } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') || 'summary'

  const [tab, setTab] = useState(VALID_TAB_IDS.has(initialTab) ? initialTab : 'summary')
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    datasets, setDatasets,
    data, setData,
    loading, status, setStatus,
    error, setError, showError,
    lastSaved, setLastSaved,
  } = useDataLoader()

  const dirtyRef = useAutosave(data, setLastSaved)

  const { uploading, handleFiles, removeDs } = useFileUpload({
    datasets, setDatasets, setData, setStatus, showError, setLastSaved, dirtyRef,
  })

  const handleTabChange = useCallback((id: string) => {
    setTab(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  const allLocations = useMemo(() => {
    if (!data) return ['All']
    return ['All', ...[...new Set(data.locationKPIs.map(l => l.location))].sort()]
  }, [data])

  const years = useMemo(() => data?.annualKPIs.map(a => a.year) || [], [data])

  // Auth gate: show login if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} />
  }

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

  const { annualKPIs, monthlyKPIs, locationKPIs, physicianRankings, alerts, funnel, zeroVisitAlerts, otPTSplit, payerMix, lagAnalysis } = data

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        datasets={datasets}
        status={status}
        fileRef={fileRef}
        userEmail={user.email || ''}
        onRemoveDs={removeDs}
        onFiles={handleFiles}
        onSignOut={signOut}
      />
      <TabNav tab={tab} onTabChange={handleTabChange} />

      <div className="max-w-7xl mx-auto p-4 space-y-4">
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
            {tab === 'payer' && <PayerMixTab payerMix={payerMix} years={years} />}
            {tab === 'lag' && <SpeedToCareTab annualKPIs={annualKPIs} lagAnalysis={lagAnalysis} years={years} />}
            {tab === 'locations' && <LocationsTab locationKPIs={locationKPIs} years={years} />}
          </>
        )}
      </div>

      {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
    </div>
  )
}
