'use client'

import { O, TABS } from './constants'

export default function TabNav({
  tab,
  onTabChange,
}: {
  tab: string
  onTabChange: (id: string) => void
}) {
  return (
    <div className="bg-white border-b shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={tab === t.id ? { color: O, borderColor: O } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
