import { describe, it, expect } from 'vitest'
import { hashPHI, batchHashPHI } from '@/lib/phi-hash'

describe('hashPHI', () => {
  it('returns consistent hash for same input', async () => {
    const h1 = await hashPHI('John Doe')
    const h2 = await hashPHI('John Doe')
    expect(h1).toBe(h2)
  })

  it('returns different hashes for different inputs', async () => {
    const h1 = await hashPHI('John Doe')
    const h2 = await hashPHI('Jane Smith')
    expect(h1).not.toBe(h2)
  })

  it('normalizes case and whitespace', async () => {
    const h1 = await hashPHI('John Doe')
    const h2 = await hashPHI('  JOHN DOE  ')
    expect(h1).toBe(h2)
  })

  it('returns empty string for empty input', async () => {
    expect(await hashPHI('')).toBe('')
  })

  it('produces hex string of 64 chars (SHA-256)', async () => {
    const h = await hashPHI('test')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('batchHashPHI', () => {
  it('hashes all values and deduplicates work', async () => {
    const map = await batchHashPHI(['Alice', 'Bob', 'Alice'])
    expect(map.size).toBe(2)
    expect(map.get('Alice')).toBeDefined()
    expect(map.get('Bob')).toBeDefined()
    expect(map.get('Alice')).not.toBe(map.get('Bob'))
  })

  it('handles empty array', async () => {
    const map = await batchHashPHI([])
    expect(map.size).toBe(0)
  })
})
