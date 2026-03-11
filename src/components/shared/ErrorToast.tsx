'use client'

import { useEffect } from 'react'

export default function ErrorToast({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-red-600 text-white rounded-lg shadow-lg px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium">Error</p>
          <p className="text-xs mt-0.5 opacity-90">{message}</p>
        </div>
        <button onClick={onDismiss} className="text-white/70 hover:text-white text-lg leading-none">
          &times;
        </button>
      </div>
    </div>
  )
}
