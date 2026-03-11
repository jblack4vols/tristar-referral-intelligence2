'use client'

import { RefObject } from 'react'
import { O } from './constants'

export default function UploadScreen({
  fileRef,
  loading,
  uploading,
  status,
  onFiles,
}: {
  fileRef: RefObject<HTMLInputElement>
  loading: boolean
  uploading: boolean
  status: string
  onFiles: (files: FileList) => void
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-8">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: O }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: O }}>
            Tristar PT — Referral Intelligence
          </h1>
          <p className="text-sm text-gray-500 mb-6">Upload Created Cases Report files to begin</p>
        </div>

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-orange-400 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onFiles(e.dataTransfer.files)
          }}
        >
          <svg className="w-10 h-10 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm font-medium text-gray-600">Drop .xlsx files here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Upload multiple years for trend analysis</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />

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
