// Hook to periodically save processed KPIs to Supabase

import { useEffect, useRef } from 'react'
import type { ProcessedData } from '@/lib/dataEngine'
import { saveProcessedKPIs } from '@/lib/supabase'

const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function useAutosave(
  data: ProcessedData | null,
  setLastSaved: (date: Date) => void,
) {
  const dataRef = useRef<ProcessedData | null>(null)
  const dirtyRef = useRef(false)

  // Keep dataRef in sync
  useEffect(() => { dataRef.current = data }, [data])

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
  }, [setLastSaved])

  return dirtyRef
}
