import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Stat from '@/components/shared/Stat'

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="Total Cases" value="1,234" />)
    expect(screen.getByText('Total Cases')).toBeDefined()
    expect(screen.getByText('1,234')).toBeDefined()
  })

  it('renders subtitle when provided', () => {
    render(<Stat label="Revenue" value="$50K" sub="+12% YoY" />)
    expect(screen.getByText('+12% YoY')).toBeDefined()
  })

  it('does not render subtitle when omitted', () => {
    const { container } = render(<Stat label="Cases" value="100" />)
    const subs = container.querySelectorAll('.text-gray-400')
    expect(subs.length).toBe(0)
  })

  it('applies custom border color', () => {
    const { container } = render(<Stat label="Test" value="1" color="#FF0000" />)
    const card = container.firstChild as HTMLElement
    expect(card.style.borderLeftColor).toBe('rgb(255, 0, 0)')
  })

  it('uses default orange color when no color prop', () => {
    const { container } = render(<Stat label="Test" value="1" />)
    const card = container.firstChild as HTMLElement
    expect(card.style.borderLeftColor).toBe('rgb(255, 130, 0)')
  })
})
