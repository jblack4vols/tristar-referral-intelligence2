// Hook to load datasets and processed KPIs from Supabase on mount

import { useState, useEffect, useCallback } from 'react'
import { processData, type DataSet, type ProcessedData } from '@/lib/dataEngine'
import {
  loadDatasets, loadCases, loadProcessedKPIs,
  saveProcessedKPIs, dbCaseToRawCase,
} from '@/lib/supabase'

export function useDataLoader() {
  const [datasets, setDatasets] = useState<DataSet[]>([])
  const [data, setData] = useState<ProcessedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const showError = useCallback((msg: string) => {
    console.error(msg)
    setError(msg)
  }, [])

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

  return {
    datasets, setDatasets,
    data, setData,
    loading, status, setStatus,
    error, setError, showError,
    lastSaved, setLastSaved,
  }
}
