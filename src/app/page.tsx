'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  )
}
