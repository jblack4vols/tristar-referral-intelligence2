// Hook to handle Excel file upload, parsing, and Supabase persistence

import { useState, useCallback } from 'react'
import { parseExcelFile, processData, type DataSet, type ProcessedData } from '@/lib/dataEngine'
import { saveDataset, saveCases, saveProcessedKPIs, deleteDataset } from '@/lib/supabase'

interface UseFileUploadOptions {
  datasets: DataSet[]
  setDatasets: (ds: DataSet[]) => void
  setData: (data: ProcessedData | null) => void
  setStatus: (status: string) => void
  showError: (msg: string) => void
  setLastSaved: (date: Date) => void
  dirtyRef: React.MutableRefObject<boolean>
}

export function useFileUpload({
  datasets, setDatasets, setData, setStatus, showError, setLastSaved, dirtyRef,
}: UseFileUploadOptions) {
  const [uploading, setUploading] = useState(false)

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
  }, [datasets, setDatasets, setData, setStatus, showError, setLastSaved, dirtyRef])

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
  }, [datasets, setDatasets, setData, showError, setLastSaved, dirtyRef])

  return { uploading, handleFiles, removeDs }
}
