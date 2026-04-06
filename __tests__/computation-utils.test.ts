import { describe, it, expect } from 'vitest'
import { parseDate, toNum, pct, rd, fmtDate, groupBy, mode, diffDays, avg } from '@/lib/computation-utils'

describe('parseDate', () => {
  it('returns Date for valid Date object', () => {
    const d = new Date('2024-01-15')
    expect(parseDate(d)).toEqual(d)
  })

  it('returns null for invalid Date', () => {
    expect(parseDate(new Date('invalid'))).toBeNull()
  })

  it('parses date strings', () => {
    const result = parseDate('2024-03-01')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getFullYear()).toBe(2024)
  })

  it('returns null for falsy values', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('toNum', () => {
  it('converts numbers', () => {
    expect(toNum(42)).toBe(42)
    expect(toNum('10')).toBe(10)
  })

  it('floors decimals', () => {
    expect(toNum(3.9)).toBe(3)
  })

  it('returns 0 for NaN', () => {
    expect(toNum('abc')).toBe(0)
    expect(toNum(null)).toBe(0)
  })
})

describe('pct', () => {
  it('calculates percentage to one decimal', () => {
    expect(pct(2, 3)).toBeCloseTo(66.7, 0)
    expect(pct(1, 4)).toBe(25)
  })

  it('returns 0 when denominator is 0', () => {
    expect(pct(5, 0)).toBe(0)
  })
})

describe('rd', () => {
  it('rounds to 2 decimals', () => {
    expect(rd(3.14159)).toBe(3.14)
    expect(rd(1.006)).toBe(1.01)
  })
})

describe('fmtDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(fmtDate(new Date(2024, 0, 5))).toBe('2024-01-05')
    expect(fmtDate(new Date(2023, 11, 25))).toBe('2023-12-25')
  })
})

describe('groupBy', () => {
  it('groups items by key function', () => {
    const items = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }]
    const result = groupBy(items, i => i.type)
    expect(Object.keys(result)).toEqual(['a', 'b'])
    expect(result['a']).toHaveLength(2)
    expect(result['b']).toHaveLength(1)
  })

  it('handles empty array', () => {
    expect(groupBy([], () => 'x')).toEqual({})
  })
})

describe('mode', () => {
  it('returns most frequent string', () => {
    expect(mode(['a', 'b', 'a', 'c', 'a'])).toBe('a')
    expect(mode(['x', 'y', 'y'])).toBe('y')
  })

  it('returns empty for empty array', () => {
    expect(mode([])).toBe('')
  })
})

describe('diffDays', () => {
  it('computes day difference', () => {
    const a = new Date('2024-01-01')
    const b = new Date('2024-01-11')
    expect(diffDays(a, b)).toBe(10)
  })

  it('returns negative for reverse order', () => {
    const a = new Date('2024-01-11')
    const b = new Date('2024-01-01')
    expect(diffDays(a, b)).toBe(-10)
  })
})

describe('avg', () => {
  it('computes average', () => {
    expect(avg([10, 20, 30])).toBe(20)
  })

  it('returns 0 for empty array', () => {
    expect(avg([])).toBe(0)
  })
})
