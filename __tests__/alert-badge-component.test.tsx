import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AlertBadge from '@/components/shared/AlertBadge'

describe('AlertBadge', () => {
  it('renders the category text', () => {
    render(<AlertBadge category="Gone Dark" />)
    expect(screen.getByText('Gone Dark')).toBeDefined()
  })

  it('applies red styling for Gone Dark', () => {
    const { container } = render(<AlertBadge category="Gone Dark" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-red-100')
    expect(badge.className).toContain('text-red-700')
  })

  it('applies green styling for Rising Star', () => {
    const { container } = render(<AlertBadge category="Rising Star" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-700')
  })

  it('applies blue styling for New Relationship', () => {
    const { container } = render(<AlertBadge category="New Relationship" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-blue-100')
  })

  it('applies gray fallback for unknown category', () => {
    const { container } = render(<AlertBadge category="Unknown" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-gray-100')
  })
})
