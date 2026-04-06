'use client'

import { RefObject } from 'react'
import { O, BK } from './constants'
import type { DataSet } from '@/lib/dataEngine'

export default function Header({
  datasets,
  status,
  fileRef,
  onRemoveDs,
  onFiles,
}: {
  datasets: DataSet[]
  status: string
  fileRef: RefObject<HTMLInputElement>
  onRemoveDs: (year: number) => void
  onFiles: (files: FileList) => void
}) {
  return (
    <div className="text-white px-4 py-3" style={{ backgroundColor: BK }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold" style={{ color: O }}>
            TRISTAR PT — Referral Intelligence
          </h1>
          <p className="text-xs text-gray-400">{datasets.map((d) => d.label).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2">
          {datasets.map((d) => (
            <span
              key={d.year}
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: '#333', color: O }}
            >
              {d.year}
              <button onClick={() => { if (window.confirm(`Remove ${d.year} data? This deletes it from the database.`)) onRemoveDs(d.year) }} className="ml-0.5 hover:text-white text-gray-500">
                &times;
              </button>
            </span>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
          >
            + Import Data
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {status && (
        <div className="max-w-7xl mx-auto">
          <p className="text-xs text-orange-300 mt-1">{status}</p>
        </div>
      )}
    </div>
  )
}
