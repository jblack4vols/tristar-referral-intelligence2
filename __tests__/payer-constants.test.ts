import { describe, it, expect } from 'vitest'
import { PAYER_RPV, PAYER_TIERS, DEFAULT_RPV, DEFAULT_VISITS_PER_EVAL, UHC_KEYWORDS } from '@/lib/payer-constants'

describe('payer constants', () => {
  it('PAYER_RPV has expected payer types', () => {
    expect(PAYER_RPV['Blue Cross/Blue Shield']).toBe(110)
    expect(PAYER_RPV['Medicare Part B']).toBe(88)
    expect(PAYER_RPV['Medicaid']).toBe(62)
  })

  it('PAYER_TIERS classifies correctly', () => {
    expect(PAYER_TIERS['Blue Cross/Blue Shield']).toBe('A')
    expect(PAYER_TIERS['Medicare Part B']).toBe('A')
    expect(PAYER_TIERS['Medicaid']).toBe('C')
    expect(PAYER_TIERS['Commercial Insurance Co.']).toBe('B')
  })

  it('DEFAULT_RPV is reasonable', () => {
    expect(DEFAULT_RPV).toBe(95)
  })

  it('DEFAULT_VISITS_PER_EVAL is set', () => {
    expect(DEFAULT_VISITS_PER_EVAL).toBe(11.2)
  })

  it('UHC_KEYWORDS detect UnitedHealthcare', () => {
    expect(UHC_KEYWORDS).toContain('UNITED')
    expect(UHC_KEYWORDS).toContain('UHC')
    expect(UHC_KEYWORDS).toContain('OPTUM')
  })
})
