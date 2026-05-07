import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ExportButton from '@/components/shared/ExportButton'

describe('ExportButton', () => {
  afterEach(cleanup)
  const rows = [
    { name: 'Alice', score: 95 },
    { name: 'Bob', score: 87 },
  ]
  const headers = [
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score' },
  ]

  it('renders export button', () => {
    render(<ExportButton rows={rows} headers={headers} fileName="test" />)
    expect(screen.getByText('Export')).toBeDefined()
  })

  it('shows dropdown on click', () => {
    render(<ExportButton rows={rows} headers={headers} fileName="test" />)

    fireEvent.click(screen.getByText('Export'))

    expect(screen.getByText('Excel (.xlsx)')).toBeDefined()
    expect(screen.getByText('CSV (.csv)')).toBeDefined()
  })
})
