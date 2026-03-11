import { describe, it, expect } from 'vitest'
import { processData, type RawCase, type DataSet } from '@/lib/dataEngine'

// ============================================================
// HELPERS
// ============================================================
function makeCase(overrides: Partial<RawCase> = {}): RawCase {
  return {
    patientAccountNumber: 'PA001',
    patientName: 'Test Patient',
    caseTherapist: 'Therapist A',
    caseFacility: 'Tristar PT - Nashville',
    referringDoctor: 'Dr. Smith',
    referringDoctorNPI: '1234567890',
    referralSource: 'Doctors Office',
    primaryPayerType: 'Blue Cross/Blue Shield',
    primaryInsurance: 'BCBS TN',
    arrivedVisits: 10,
    scheduledVisits: 12,
    createdDate: new Date('2024-02-15'),
    dateOfInitialEval: new Date('2024-02-20'),
    dischargeDate: new Date('2024-05-01'),
    dateOfFirstScheduledVisit: new Date('2024-02-18'),
    dateOfFirstArrivedVisit: new Date('2024-02-20'),
    discipline: 'PT',
    dischargeReason: 'Goals Met',
    year: 2024,
    isPhysician: true,
    isUHC: false,
    ...overrides,
  }
}

function makeDataset(year: number, cases: RawCase[]): DataSet {
  return {
    label: `${year}`,
    year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    cases,
  }
}

// ============================================================
// ANNUAL KPI TESTS
// ============================================================
describe('processData — annualKPIs', () => {
  it('computes correct totals for a single year', () => {
    const cases = [
      makeCase({ arrivedVisits: 10 }),
      makeCase({ arrivedVisits: 5, referralSource: 'Self', referringDoctorNPI: '', isPhysician: false }),
      makeCase({ arrivedVisits: 8 }),
    ]
    const ds = [makeDataset(2024, cases)]
    const result = processData(ds)

    expect(result.annualKPIs).toHaveLength(1)
    const kpi = result.annualKPIs[0]
    expect(kpi.year).toBe(2024)
    expect(kpi.totalCases).toBe(3)
    expect(kpi.physicianCases).toBe(2)
    expect(kpi.nonPhysicianCases).toBe(1)
    expect(kpi.totalVisits).toBe(23) // 10 + 5 + 8
  })

  it('computes physician percentage', () => {
    const cases = [
      makeCase({}),
      makeCase({}),
      makeCase({ isPhysician: false, referralSource: 'Self', referringDoctorNPI: '' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const kpi = result.annualKPIs[0]
    // 2 out of 3 = 66.7%
    expect(kpi.physicianPct).toBeCloseTo(66.7, 0)
  })

  it('computes weighted revenue using payer RPV', () => {
    const cases = [
      makeCase({ arrivedVisits: 10, primaryPayerType: 'Blue Cross/Blue Shield' }), // 10 * 110 = 1100
      makeCase({ arrivedVisits: 5, primaryPayerType: 'Medicare Part B' }),          // 5 * 88 = 440
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.annualKPIs[0].weightedRevenue).toBe(1540)
  })

  it('uses default RPV for unknown payer types', () => {
    const cases = [
      makeCase({ arrivedVisits: 10, primaryPayerType: 'Unknown Payer XYZ' }), // 10 * 95 = 950
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.annualKPIs[0].weightedRevenue).toBe(950)
  })

  it('computes OT percentage', () => {
    const cases = [
      makeCase({ discipline: 'PT' }),
      makeCase({ discipline: 'PT' }),
      makeCase({ discipline: 'OT' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const kpi = result.annualKPIs[0]
    expect(kpi.otCases).toBe(1)
    expect(kpi.ptCases).toBe(2)
    expect(kpi.otPct).toBeCloseTo(33.3, 0)
  })

  it('computes Tier A percentage', () => {
    const cases = [
      makeCase({ primaryPayerType: 'Blue Cross/Blue Shield' }),   // Tier A
      makeCase({ primaryPayerType: 'Medicare Part B' }),           // Tier A
      makeCase({ primaryPayerType: 'Medicaid' }),                  // Tier C
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.annualKPIs[0].tierAPct).toBeCloseTo(66.7, 0)
  })

  it('computes arrival rate', () => {
    const cases = [
      makeCase({ arrivedVisits: 10 }),
      makeCase({ arrivedVisits: 5 }),
      makeCase({ arrivedVisits: 0 }),   // did not arrive
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.annualKPIs[0].arriveRate).toBeCloseTo(66.7, 0)
  })

  it('computes unique physician count', () => {
    const cases = [
      makeCase({ referringDoctorNPI: 'NPI001' }),
      makeCase({ referringDoctorNPI: 'NPI001' }), // same NPI
      makeCase({ referringDoctorNPI: 'NPI002' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.annualKPIs[0].uniquePhysicians).toBe(2)
  })

  it('handles empty dataset gracefully', () => {
    const result = processData([makeDataset(2024, [])])
    const kpi = result.annualKPIs[0]
    expect(kpi.totalCases).toBe(0)
    expect(kpi.weightedRevenue).toBe(0)
    expect(kpi.avgVE).toBe(0)
  })
})

// ============================================================
// MULTI-YEAR / ALERT TESTS
// ============================================================
describe('processData — alerts', () => {
  it('returns no alerts with a single year', () => {
    const result = processData([makeDataset(2024, [makeCase({})])])
    expect(result.alerts).toHaveLength(0)
  })

  it('detects Gone Dark physicians', () => {
    const prior = [
      makeCase({ year: 2023, createdDate: new Date('2023-06-01'), referringDoctorNPI: 'NPI001' }),
      makeCase({ year: 2023, createdDate: new Date('2023-07-01'), referringDoctorNPI: 'NPI001' }),
      makeCase({ year: 2023, createdDate: new Date('2023-08-01'), referringDoctorNPI: 'NPI001' }),
    ]
    const latest = [
      // NPI001 sent 0 in 2024
      makeCase({ year: 2024, createdDate: new Date('2024-06-01'), referringDoctorNPI: 'NPI999' }),
    ]
    const result = processData([makeDataset(2023, prior), makeDataset(2024, latest)])
    const goneDark = result.alerts.filter(a => a.category === 'Gone Dark')
    expect(goneDark.length).toBeGreaterThanOrEqual(1)
    expect(goneDark[0].npi).toBe('NPI001')
    expect(goneDark[0].estRevImpact).toBeLessThan(0)
  })

  it('detects New Relationship physicians', () => {
    const prior = [
      makeCase({ year: 2023, createdDate: new Date('2023-06-01'), referringDoctorNPI: 'NPI001' }),
    ]
    const latest = [
      makeCase({ year: 2024, createdDate: new Date('2024-01-01'), referringDoctorNPI: 'NPI002' }),
      makeCase({ year: 2024, createdDate: new Date('2024-02-01'), referringDoctorNPI: 'NPI002' }),
      makeCase({ year: 2024, createdDate: new Date('2024-03-01'), referringDoctorNPI: 'NPI002' }),
    ]
    const result = processData([makeDataset(2023, prior), makeDataset(2024, latest)])
    const newRel = result.alerts.filter(a => a.category === 'New Relationship')
    expect(newRel.length).toBeGreaterThanOrEqual(1)
    expect(newRel[0].npi).toBe('NPI002')
    expect(newRel[0].estRevImpact).toBeGreaterThan(0)
  })

  it('detects Sharp Decline (>=50% drop)', () => {
    const prior = Array.from({ length: 10 }, (_, i) =>
      makeCase({ year: 2023, createdDate: new Date(`2023-${String(i % 12 + 1).padStart(2, '0')}-15`), referringDoctorNPI: 'NPI001' })
    )
    const latest = Array.from({ length: 3 }, (_, i) =>
      makeCase({ year: 2024, createdDate: new Date(`2024-${String(i + 1).padStart(2, '0')}-15`), referringDoctorNPI: 'NPI001' })
    )
    const result = processData([makeDataset(2023, prior), makeDataset(2024, latest)])
    const decline = result.alerts.filter(a => a.category === 'Sharp Decline')
    expect(decline.length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================
// MONTHLY KPI TESTS
// ============================================================
describe('processData — monthlyKPIs', () => {
  it('groups cases by month correctly', () => {
    const cases = [
      makeCase({ createdDate: new Date('2024-01-15') }),
      makeCase({ createdDate: new Date('2024-01-20') }),
      makeCase({ createdDate: new Date('2024-02-10') }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const jan = result.monthlyKPIs.find(m => m.month === '2024-01')
    const feb = result.monthlyKPIs.find(m => m.month === '2024-02')
    expect(jan?.totalCases).toBe(2)
    expect(feb?.totalCases).toBe(1)
  })

  it('computes monthly weighted revenue', () => {
    const cases = [
      makeCase({ createdDate: new Date('2024-03-15'), arrivedVisits: 10, primaryPayerType: 'Blue Cross/Blue Shield' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const mar = result.monthlyKPIs.find(m => m.month === '2024-03')
    expect(mar?.weightedRev).toBe(1100) // 10 * 110
  })
})

// ============================================================
// LOCATION KPI TESTS
// ============================================================
describe('processData — locationKPIs', () => {
  it('groups by facility and strips prefix', () => {
    const cases = [
      makeCase({ caseFacility: 'Tristar PT - Nashville' }),
      makeCase({ caseFacility: 'Tristar PT - Nashville' }),
      makeCase({ caseFacility: 'Tristar PT - Franklin' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const locations = result.locationKPIs.map(l => l.location)
    expect(locations).toContain('Nashville')
    expect(locations).toContain('Franklin')
    const nash = result.locationKPIs.find(l => l.location === 'Nashville')
    expect(nash?.totalCases).toBe(2)
  })
})

// ============================================================
// PHYSICIAN RANKING TESTS
// ============================================================
describe('processData — physicianRankings', () => {
  it('ranks physicians by weighted revenue descending', () => {
    const cases = [
      makeCase({ referringDoctorNPI: 'NPI001', referringDoctor: 'Dr. High', arrivedVisits: 20 }),
      makeCase({ referringDoctorNPI: 'NPI002', referringDoctor: 'Dr. Low', arrivedVisits: 2 }),
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.physicianRankings[0].npi).toBe('NPI001')
    expect(result.physicianRankings[1].npi).toBe('NPI002')
  })

  it('computes trend across years', () => {
    const cases = [
      makeCase({ year: 2023, createdDate: new Date('2023-06-01'), referringDoctorNPI: 'NPI001', arrivedVisits: 5 }),
      makeCase({ year: 2024, createdDate: new Date('2024-06-01'), referringDoctorNPI: 'NPI001', arrivedVisits: 5 }),
      makeCase({ year: 2024, createdDate: new Date('2024-07-01'), referringDoctorNPI: 'NPI001', arrivedVisits: 5 }),
    ]
    const result = processData([makeDataset(2023, [cases[0]]), makeDataset(2024, [cases[1], cases[2]])])
    const dr = result.physicianRankings.find(p => p.npi === 'NPI001')
    expect(dr?.trend).toBe('Growing')
  })
})

// ============================================================
// FUNNEL TESTS
// ============================================================
describe('processData — funnel', () => {
  it('computes conversion funnel rates', () => {
    const cases = [
      makeCase({
        dateOfFirstScheduledVisit: new Date('2024-02-18'),
        arrivedVisits: 10,
        dateOfInitialEval: new Date('2024-02-20'),
        dischargeDate: new Date('2024-05-01'),
      }),
      makeCase({
        dateOfFirstScheduledVisit: new Date('2024-03-01'),
        arrivedVisits: 0,
        dateOfInitialEval: null,
        dischargeDate: null,
      }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const f = result.funnel.find(f => f.location === 'Nashville')
    expect(f).toBeDefined()
    expect(f!.created).toBe(2)
    expect(f!.schedRate).toBe(100) // both scheduled
    expect(f!.arriveRate).toBe(50) // 1 of 2 arrived
    expect(f!.evalRate).toBe(50)   // 1 of 2 evaluated
    expect(f!.dcRate).toBe(50)     // 1 of 2 discharged
  })
})

// ============================================================
// ZERO-VISIT ALERT TESTS
// ============================================================
describe('processData — zeroVisitAlerts', () => {
  it('flags physicians with multiple patients but zero visits', () => {
    const cases = [
      makeCase({
        referringDoctorNPI: 'NPI001', patientName: 'Patient A',
        arrivedVisits: 0, dateOfFirstScheduledVisit: null,
        dateOfInitialEval: null, dischargeDate: null,
      }),
      makeCase({
        referringDoctorNPI: 'NPI001', patientName: 'Patient B',
        arrivedVisits: 0, dateOfFirstScheduledVisit: null,
        dateOfInitialEval: null, dischargeDate: null,
      }),
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.zeroVisitAlerts.length).toBeGreaterThanOrEqual(1)
    expect(result.zeroVisitAlerts[0].issue).toBe('Never Scheduled')
  })

  it('distinguishes scheduling vs no-show issues', () => {
    const cases = [
      makeCase({
        referringDoctorNPI: 'NPI001', patientName: 'Patient A',
        arrivedVisits: 0, dateOfFirstScheduledVisit: new Date('2024-02-18'),
        dateOfInitialEval: null, dischargeDate: null,
      }),
      makeCase({
        referringDoctorNPI: 'NPI001', patientName: 'Patient B',
        arrivedVisits: 0, dateOfFirstScheduledVisit: new Date('2024-03-01'),
        dateOfInitialEval: null, dischargeDate: null,
      }),
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.zeroVisitAlerts[0].issue).toBe('Scheduling/No-Show')
  })

  it('does not flag physicians with fewer than 2 unique patients', () => {
    const cases = [
      makeCase({
        referringDoctorNPI: 'NPI001', patientName: 'Same Patient',
        arrivedVisits: 0, dateOfFirstScheduledVisit: null,
        dateOfInitialEval: null, dischargeDate: null,
      }),
      makeCase({
        referringDoctorNPI: 'NPI001', patientName: 'Same Patient',
        arrivedVisits: 0, dateOfFirstScheduledVisit: null,
        dateOfInitialEval: null, dischargeDate: null,
      }),
    ]
    const result = processData([makeDataset(2024, cases)])
    expect(result.zeroVisitAlerts).toHaveLength(0)
  })
})

// ============================================================
// OT/PT SPLIT TESTS
// ============================================================
describe('processData — otPTSplit', () => {
  it('computes OT/PT breakdown by location', () => {
    const cases = [
      makeCase({ discipline: 'PT' }),
      makeCase({ discipline: 'OT' }),
      makeCase({ discipline: 'PT' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const nash = result.otPTSplit.find(o => o.location === 'Nashville')
    expect(nash?.ptCases).toBe(2)
    expect(nash?.otCases).toBe(1)
    expect(nash?.otPct).toBeCloseTo(33.3, 0)
  })
})

// ============================================================
// PAYER MIX TESTS
// ============================================================
describe('processData — payerMix', () => {
  it('groups by payer type and calculates percentages', () => {
    const cases = [
      makeCase({ primaryPayerType: 'Blue Cross/Blue Shield' }),
      makeCase({ primaryPayerType: 'Blue Cross/Blue Shield' }),
      makeCase({ primaryPayerType: 'Medicare Part B' }),
    ]
    const result = processData([makeDataset(2024, cases)])
    const bcbs = result.payerMix.find(p => p.payerType === 'Blue Cross/Blue Shield')
    expect(bcbs?.count).toBe(2)
    expect(bcbs?.pct).toBeCloseTo(66.7, 0)
  })
})

// ============================================================
// MULTI-YEAR TESTS
// ============================================================
describe('processData — multi-year', () => {
  it('produces annual KPIs for each year', () => {
    const ds1 = makeDataset(2023, [
      makeCase({ year: 2023, createdDate: new Date('2023-06-01'), arrivedVisits: 5 }),
    ])
    const ds2 = makeDataset(2024, [
      makeCase({ year: 2024, createdDate: new Date('2024-06-01'), arrivedVisits: 10 }),
    ])
    const result = processData([ds1, ds2])
    expect(result.annualKPIs).toHaveLength(2)
    expect(result.annualKPIs.map(a => a.year)).toEqual([2023, 2024])
  })
})
