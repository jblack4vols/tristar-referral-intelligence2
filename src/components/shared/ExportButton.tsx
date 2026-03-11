'use client'

import { useState } from 'react'
import { exportToExcel, exportToCSV } from '@/lib/exportUtils'
import { O } from './constants'

export default function ExportButton({
  rows,
  headers,
  fileName,
}: {
  rows: Record<string, string | number>[]
  headers: { key: string; label: string }[]
  fileName: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-20 py-1 min-w-[100px]">
          <button
            onClick={() => { exportToExcel(rows, headers, fileName); setOpen(false) }}
            className="block w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50"
            style={{ color: O }}
          >
            Excel (.xlsx)
          </button>
          <button
            onClick={() => { exportToCSV(rows, headers, fileName); setOpen(false) }}
            className="block w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50"
            style={{ color: O }}
          >
            CSV (.csv)
          </button>
        </div>
      )}
    </div>
  )
}
