import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tristar PT — Referral Intelligence',
  description: 'Multi-year referral analysis dashboard for Tristar Physical Therapy',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
