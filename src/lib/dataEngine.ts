import * as XLSX from 'xlsx';

// ============================================================
// TYPES
// ============================================================
export interface RawCase {
  patientAccountNumber: string;
  patientName: string;
  caseTherapist: string;
  caseFacility: string;
  referringDoctor: string;
  referringDoctorNPI: string;
  referralSource: string;
  primaryPayerType: string;
  primaryInsurance: string;
  arrivedVisits: number;
  scheduledVisits: number;
  createdDate: Date | null;
  dateOfInitialEval: Date | null;
  dischargeDate: Date | null;
  dateOfFirstScheduledVisit: Date | null;
  dateOfFirstArrivedVisit: Date | null;
  discipline: string;
  dischargeReason: string;
  year: number;
  isPhysician: boolean;
  isUHC: boolean;
}

export interface DataSet {
  label: string;
  year: number;
  startDate: string;
  endDate: string;
  cases: RawCase[];
}

export interface ProcessedData {
  datasets: DataSet[];
  annualKPIs: AnnualKPI[];
  monthlyKPIs: MonthlyKPI[];
  locationKPIs: LocationKPI[];
  physicianRankings: PhysicianRanking[];
  alerts: Alert[];
  funnel: FunnelRow[];
  zeroVisitAlerts: ZeroVisitAlert[];
  otPTSplit: OTPTRow[];
  payerMix: PayerMixRow[];
  lagAnalysis: LagAnalysisRow[];
}

export interface AnnualKPI {
  year: number;
  totalCases: number;
  physicianCases: number;
  nonPhysicianCases: number;
  physicianPct: number;
  totalVisits: number;
  physicianVisits: number;
  avgVE: number;
  arriveRate: number;
  evalRate: number;
  flatRevenue: number;
  weightedRevenue: number;
  avgWeightedRPV: number;
  uniquePhysicians: number;
  locations: number;
  ptCases: number;
  otCases: number;
  otPct: number;
  tierAPct: number;
}

export interface MonthlyKPI {
  month: string;
  totalCases: number;
  physCases: number;
  nonPhysCases: number;
  totalVisits: number;
  arriveRate: number;
  avgRPV: number;
  tierAPct: number;
  otPct: number;
  weightedRev: number;
}

export interface LocationKPI {
  year: number;
  location: string;
  totalCases: number;
  physCases: number;
  totalVisits: number;
  physVisits: number;
  weightedRev: number;
  avgRPV: number;
  avgVE: number;
  arriveRate: number;
  evalRate: number;
  ptCases: number;
  otCases: number;
  otPct: number;
  uniquePhysicians: number;
}

export interface PhysicianRanking {
  npi: string;
  physician: string;
  location: string;
  yearData: Record<number, { evals: number; visits: number }>;
  totalEvals: number;
  totalVisits: number;
  weightedRev: number;
  avgRPV: number;
  avgVE: number;
  tierAPct: number;
  dominantPayer: string;
  trend: string;
  alert: string;
}

export interface Alert {
  physician: string;
  npi: string;
  location: string;
  evalsOld: number;
  evalsNew: number;
  pctChange: number | null;
  category: string;
  estRevImpact: number;
}

export interface FunnelRow {
  year: number;
  location: string;
  created: number;
  scheduled: number;
  arrived: number;
  evalCompleted: number;
  discharged: number;
  schedRate: number;
  arriveRate: number;
  evalRate: number;
  dcRate: number;
}

export interface ZeroVisitAlert {
  physician: string;
  npi: string;
  location: string;
  evals: number;
  uniquePatients: number;
  issue: string;
  estLostRev: number;
}

export interface OTPTRow {
  year: number;
  location: string;
  ptCases: number;
  otCases: number;
  otPct: number;
}

export interface PayerMixRow {
  year: number;
  payerType: string;
  count: number;
  pct: number;
}

export interface LagAnalysisRow {
  year: number;
  location: string;
  avgCreatedToSchedDays: number;
  avgCreatedToEvalDays: number;
  avgSchedToArriveDays: number;
  caseCount: number;
}

// ============================================================
// CONSTANTS
// ============================================================
const PAYER_RPV: Record<string, number> = {
  'Blue Cross/Blue Shield': 110,
  'Medicare Part B': 88,
  'Health Maintenance Organization (HMO) Medicare Risk': 78,
  'Health Maintenance Organization (HMO) Medicare Risk (Contracted)': 78,
  'Commercial Insurance Co.': 105,
  'Veterans Affairs Plan': 95,
  "Workers' Compensation Health Claim": 120,
  "Workers' Compensation Health Claim (Contracted)": 120,
  'Liability Medical': 130,
  'Medicaid': 62,
  'Health Maintenance Organization': 70,
  'Self Pay': 85,
  'Other Non-Federal Programs': 80,
  'Automobile Medical': 130,
};

const PAYER_TIERS: Record<string, string> = {
  'Blue Cross/Blue Shield': 'A',
  'Medicare Part B': 'A',
  'Commercial Insurance Co.': 'B',
  'Health Maintenance Organization (HMO) Medicare Risk': 'B',
  'Veterans Affairs Plan': 'B',
  "Workers' Compensation Health Claim": 'B',
  "Workers' Compensation Health Claim (Contracted)": 'B',
  'Liability Medical': 'B',
  'Medicaid': 'C',
  'Health Maintenance Organization': 'C',
  'Self Pay': 'C',
};

const DEFAULT_RPV = 95;
const UHC_KEYWORDS = ['UNITED', 'UHC', 'OPTUM'];

// ============================================================
// EXCEL PARSER
// ============================================================
export function parseExcelFile(buffer: ArrayBuffer, fileName: string): DataSet {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const cases: RawCase[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const row of raw) {
    const facility = String(row['Case Facility'] || '').trim();
    if (facility === 'Billing' || !facility) continue;

    const npi = String(row['Referring Doctor NPI'] || '')
      .trim()
      .replace(/\.0$/, '')
      .replace(/^nan$/i, '')
      .replace(/^None$/i, '');

    const refSource = String(row['Referral Source'] || '').trim();
    const insurance = String(row['Primary Insurance'] || '').trim().toUpperCase();

    const createdDate = parseDate(row['Created Date']);
    if (createdDate) {
      if (!minDate || createdDate < minDate) minDate = createdDate;
      if (!maxDate || createdDate > maxDate) maxDate = createdDate;
    }

    const c: RawCase = {
      patientAccountNumber: String(row['Patient Account Number'] || ''),
      patientName: String(row['Patient Name'] || '').trim(),
      caseTherapist: String(row['Case Therapist'] || '').trim(),
      caseFacility: facility,
      referringDoctor: String(row['Referring Doctor'] || '').trim(),
      referringDoctorNPI: npi,
      referralSource: refSource,
      primaryPayerType: String(row['Primary Payer Type'] || '').trim(),
      primaryInsurance: insurance,
      arrivedVisits: toNum(row['Arrived Visits']),
      scheduledVisits: toNum(row['Scheduled Visits']),
      createdDate,
      dateOfInitialEval: parseDate(row['Date of Initial Eval']),
      dischargeDate: parseDate(row['Discharge Date']),
      dateOfFirstScheduledVisit: parseDate(row['Date of First Scheduled Visit']),
      dateOfFirstArrivedVisit: parseDate(row['Date of First Arrived Visit']),
      discipline: String(row['Discipline'] || '').trim(),
      dischargeReason: String(row['Discharge Reason'] || '').trim(),
      year: createdDate ? createdDate.getFullYear() : 0,
      isPhysician: refSource === 'Doctors Office' && npi !== '',
      isUHC: UHC_KEYWORDS.some(k => insurance.includes(k)),
    };

    cases.push(c);
  }

  const year = minDate ? minDate.getFullYear() : 0;
  const startDate = minDate ? fmtDate(minDate) : '';
  const endDate = maxDate ? fmtDate(maxDate) : '';

  // Try to extract year from filename
  const match = fileName.match(/(\d{2})-(\d{2})-(\d{2})/);
  const fileYear = match ? 2000 + parseInt(match[3]) : year;

  return {
    label: `${fileYear} (${startDate} – ${endDate})`,
    year: fileYear || year,
    startDate,
    endDate,
    cases,
  };
}

// ============================================================
// PROCESS ALL DATASETS
// ============================================================
export function processData(datasets: DataSet[]): ProcessedData {
  const allCases = datasets.flatMap(d => d.cases);
  const years = [...new Set(datasets.map(d => d.year))].sort();
  const physCases = allCases.filter(c => c.isPhysician);

  // Annual KPIs
  const annualKPIs = years.map(yr => computeAnnualKPI(allCases.filter(c => c.year === yr), yr));

  // Monthly KPIs
  const monthlyKPIs = computeMonthlyKPIs(allCases);

  // Location KPIs
  const locationKPIs = computeLocationKPIs(allCases, years);

  // Physician Rankings (using latest 2 years for alerts)
  const sortedYears = [...years].sort((a, b) => a - b);
  const latestYear = sortedYears[sortedYears.length - 1];
  const priorYear = sortedYears.length > 1 ? sortedYears[sortedYears.length - 2] : null;
  const physicianRankings = computePhysicianRankings(physCases, years);

  // Alerts (Q1 aligned if we have 2 years)
  const alerts = priorYear ? computeAlerts(physCases, priorYear, latestYear) : [];

  // Funnel
  const funnel = computeFunnel(physCases, years);

  // Zero-visit alerts (latest year)
  const zeroVisitAlerts = computeZeroVisitAlerts(physCases.filter(c => c.year === latestYear));

  // OT/PT
  const otPTSplit = computeOTPT(physCases, years);

  // Payer mix
  const payerMix = computePayerMix(physCases, years);

  // Lag analysis
  const lagAnalysis = computeLagAnalysis(physCases, years);

  return {
    datasets,
    annualKPIs,
    monthlyKPIs,
    locationKPIs,
    physicianRankings,
    alerts,
    funnel,
    zeroVisitAlerts,
    otPTSplit,
    payerMix,
    lagAnalysis,
  };
}

// ============================================================
// COMPUTATION HELPERS
// ============================================================
function computeAnnualKPI(cases: RawCase[], year: number): AnnualKPI {
  const phys = cases.filter(c => c.isPhysician);
  const nonPhys = cases.filter(c => !c.isPhysician);
  const totalVisits = sum(cases, c => c.arrivedVisits);
  const physVisits = sum(phys, c => c.arrivedVisits);
  const arrived = cases.filter(c => c.arrivedVisits > 0).length;
  const evalDone = cases.filter(c => c.dateOfInitialEval !== null).length;
  const weightedRev = sum(cases, c => c.arrivedVisits * (PAYER_RPV[c.primaryPayerType] || DEFAULT_RPV));
  const pt = cases.filter(c => /PT|Physical/i.test(c.discipline)).length;
  const ot = cases.filter(c => /OT|Occupational/i.test(c.discipline)).length;
  const tierA = cases.filter(c => PAYER_TIERS[c.primaryPayerType] === 'A').length;
  const locs = new Set(cases.map(c => c.caseFacility));
  const physicians = new Set(phys.map(c => c.referringDoctorNPI));

  return {
    year,
    totalCases: cases.length,
    physicianCases: phys.length,
    nonPhysicianCases: nonPhys.length,
    physicianPct: pct(phys.length, cases.length),
    totalVisits,
    physicianVisits: physVisits,
    avgVE: rd(totalVisits / (cases.length || 1)),
    arriveRate: pct(arrived, cases.length),
    evalRate: pct(evalDone, cases.length),
    flatRevenue: totalVisits * DEFAULT_RPV,
    weightedRevenue: weightedRev,
    avgWeightedRPV: rd(weightedRev / (totalVisits || 1)),
    uniquePhysicians: physicians.size,
    locations: locs.size,
    ptCases: pt,
    otCases: ot,
    otPct: pct(ot, cases.length),
    tierAPct: pct(tierA, cases.length),
  };
}

function computeMonthlyKPIs(cases: RawCase[]): MonthlyKPI[] {
  const byMonth = groupBy(cases, c => c.createdDate ? `${c.createdDate.getFullYear()}-${String(c.createdDate.getMonth() + 1).padStart(2, '0')}` : 'unknown');
  delete byMonth['unknown'];

  return Object.keys(byMonth).sort().map(month => {
    const grp = byMonth[month];
    const phys = grp.filter(c => c.isPhysician);
    const totalVisits = sum(grp, c => c.arrivedVisits);
    const weightedRev = sum(grp, c => c.arrivedVisits * (PAYER_RPV[c.primaryPayerType] || DEFAULT_RPV));
    const tierA = grp.filter(c => PAYER_TIERS[c.primaryPayerType] === 'A').length;
    const arrived = grp.filter(c => c.arrivedVisits > 0).length;
    const ot = grp.filter(c => /OT|Occupational/i.test(c.discipline)).length;

    return {
      month,
      totalCases: grp.length,
      physCases: phys.length,
      nonPhysCases: grp.length - phys.length,
      totalVisits,
      arriveRate: pct(arrived, grp.length),
      avgRPV: rd(weightedRev / (totalVisits || 1)),
      tierAPct: pct(tierA, grp.length),
      otPct: pct(ot, grp.length),
      weightedRev,
    };
  });
}

function computeLocationKPIs(cases: RawCase[], years: number[]): LocationKPI[] {
  const results: LocationKPI[] = [];
  for (const yr of years) {
    const yrCases = cases.filter(c => c.year === yr);
    const byLoc = groupBy(yrCases, c => c.caseFacility);
    for (const [loc, grp] of Object.entries(byLoc)) {
      const phys = grp.filter(c => c.isPhysician);
      const tv = sum(grp, c => c.arrivedVisits);
      const pv = sum(phys, c => c.arrivedVisits);
      const wRev = sum(grp, c => c.arrivedVisits * (PAYER_RPV[c.primaryPayerType] || DEFAULT_RPV));
      const arrived = grp.filter(c => c.arrivedVisits > 0).length;
      const evalDone = grp.filter(c => c.dateOfInitialEval !== null).length;
      const pt = grp.filter(c => /PT|Physical/i.test(c.discipline)).length;
      const ot = grp.filter(c => /OT|Occupational/i.test(c.discipline)).length;
      results.push({
        year: yr,
        location: loc.replace('Tristar PT - ', ''),
        totalCases: grp.length,
        physCases: phys.length,
        totalVisits: tv,
        physVisits: pv,
        weightedRev: wRev,
        avgRPV: rd(wRev / (tv || 1)),
        avgVE: rd(tv / (grp.length || 1)),
        arriveRate: pct(arrived, grp.length),
        evalRate: pct(evalDone, grp.length),
        ptCases: pt,
        otCases: ot,
        otPct: pct(ot, grp.length),
        uniquePhysicians: new Set(phys.map(c => c.referringDoctorNPI)).size,
      });
    }
  }
  return results;
}

function computePhysicianRankings(physCases: RawCase[], years: number[]): PhysicianRanking[] {
  const byNPILoc = groupBy(physCases, c => `${c.referringDoctorNPI}||${c.caseFacility}`);
  const rankings: PhysicianRanking[] = [];

  for (const [key, grp] of Object.entries(byNPILoc)) {
    const [npi, loc] = key.split('||');
    const name = mode(grp.map(c => c.referringDoctor));
    const yearData: Record<number, { evals: number; visits: number }> = {};
    for (const yr of years) {
      const yrGrp = grp.filter(c => c.year === yr);
      yearData[yr] = { evals: yrGrp.length, visits: sum(yrGrp, c => c.arrivedVisits) };
    }
    const totalEvals = grp.length;
    const totalVisits = sum(grp, c => c.arrivedVisits);
    const wRev = sum(grp, c => c.arrivedVisits * (PAYER_RPV[c.primaryPayerType] || DEFAULT_RPV));
    const tierA = grp.filter(c => PAYER_TIERS[c.primaryPayerType] === 'A').length;
    const payers = groupBy(grp, c => c.primaryPayerType);
    const domPayer = Object.entries(payers).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || '';

    // Trend from full years (exclude partial)
    const fullYears = years.filter(y => yearData[y]?.evals > 0);
    let trend = 'N/A';
    if (fullYears.length >= 2) {
      const first = yearData[fullYears[0]]?.evals || 0;
      const last = yearData[fullYears[fullYears.length - 1]]?.evals || 0;
      trend = last > first ? 'Growing' : last < first ? 'Declining' : 'Stable';
    }

    rankings.push({
      npi,
      physician: name,
      location: loc.replace('Tristar PT - ', ''),
      yearData,
      totalEvals,
      totalVisits,
      weightedRev: wRev,
      avgRPV: rd(wRev / (totalVisits || 1)),
      avgVE: rd(totalVisits / (totalEvals || 1)),
      tierAPct: pct(tierA, totalEvals),
      dominantPayer: domPayer,
      trend,
      alert: '',
    });
  }

  return rankings.sort((a, b) => b.weightedRev - a.weightedRev);
}

function computeAlerts(physCases: RawCase[], priorYear: number, latestYear: number): Alert[] {
  // Q1 aligned: Jan 1 - Mar 9
  const q1Prior = physCases.filter(c => c.year === priorYear && c.createdDate && c.createdDate.getMonth() < 3 && c.createdDate.getDate() <= 9);
  const q1Latest = physCases.filter(c => c.year === latestYear && c.createdDate && c.createdDate.getMonth() < 3 && c.createdDate.getDate() <= 9);

  // If latest data doesn't span Q1, use full datasets
  const useQ1 = q1Latest.length > 0 && q1Prior.length > 0;
  const prior = useQ1 ? q1Prior : physCases.filter(c => c.year === priorYear);
  const latest = useQ1 ? q1Latest : physCases.filter(c => c.year === latestYear);

  const priorByNPILoc = groupBy(prior, c => `${c.referringDoctorNPI}||${c.caseFacility}`);
  const latestByNPILoc = groupBy(latest, c => `${c.referringDoctorNPI}||${c.caseFacility}`);

  const allKeys = new Set([...Object.keys(priorByNPILoc), ...Object.keys(latestByNPILoc)]);
  const alerts: Alert[] = [];

  // Get full-year V/E for revenue estimation
  const fyPrior = physCases.filter(c => c.year === priorYear);
  const fyByNPI = groupBy(fyPrior, c => c.referringDoctorNPI);
  const npiVE: Record<string, number> = {};
  for (const [npi, grp] of Object.entries(fyByNPI)) {
    const v = sum(grp, c => c.arrivedVisits);
    npiVE[npi] = v / (grp.length || 1);
  }

  for (const key of allKeys) {
    const [npi, loc] = key.split('||');
    const pGrp = priorByNPILoc[key] || [];
    const lGrp = latestByNPILoc[key] || [];
    const ePrior = pGrp.length;
    const eLatest = lGrp.length;
    const name = mode([...pGrp, ...lGrp].map(c => c.referringDoctor));
    const ve = npiVE[npi] || 11.2;

    let category = '';
    let pctChange: number | null = null;
    if (ePrior > 0) pctChange = rd(((eLatest - ePrior) / ePrior) * 100);

    if (ePrior >= 3 && eLatest === 0) category = 'Gone Dark';
    else if (ePrior >= 3 && eLatest > 0 && pctChange !== null && pctChange <= -50) category = 'Sharp Decline';
    else if (ePrior >= 3 && pctChange !== null && pctChange < -20 && pctChange > -50) category = 'Moderate Decline';
    else if (eLatest >= 2 && ePrior > 0 && pctChange !== null && pctChange >= 50) category = 'Rising Star';
    else if (ePrior === 0 && eLatest >= 3) category = 'New Relationship';

    if (category) {
      const evalDelta = eLatest - ePrior;
      const estRev = Math.round(evalDelta * ve * DEFAULT_RPV);
      alerts.push({
        physician: name,
        npi,
        location: loc.replace('Tristar PT - ', ''),
        evalsOld: ePrior,
        evalsNew: eLatest,
        pctChange,
        category,
        estRevImpact: estRev,
      });
    }
  }

  return alerts.sort((a, b) => {
    const order: Record<string, number> = { 'Gone Dark': 0, 'Sharp Decline': 1, 'Moderate Decline': 2, 'Rising Star': 3, 'New Relationship': 4 };
    return (order[a.category] ?? 5) - (order[b.category] ?? 5);
  });
}

function computeFunnel(physCases: RawCase[], years: number[]): FunnelRow[] {
  const results: FunnelRow[] = [];
  for (const yr of years) {
    const byLoc = groupBy(physCases.filter(c => c.year === yr), c => c.caseFacility);
    for (const [loc, grp] of Object.entries(byLoc)) {
      const created = grp.length;
      const scheduled = grp.filter(c => c.dateOfFirstScheduledVisit !== null).length;
      const arrived = grp.filter(c => c.arrivedVisits > 0).length;
      const evalDone = grp.filter(c => c.dateOfInitialEval !== null).length;
      const dc = grp.filter(c => c.dischargeDate !== null).length;
      results.push({
        year: yr,
        location: loc.replace('Tristar PT - ', ''),
        created, scheduled, arrived, evalCompleted: evalDone, discharged: dc,
        schedRate: pct(scheduled, created),
        arriveRate: pct(arrived, created),
        evalRate: pct(evalDone, created),
        dcRate: pct(dc, created),
      });
    }
  }
  return results;
}

function computeZeroVisitAlerts(cases: RawCase[]): ZeroVisitAlert[] {
  const byNPILoc = groupBy(cases, c => `${c.referringDoctorNPI}||${c.caseFacility}`);
  const alerts: ZeroVisitAlert[] = [];

  for (const [key, grp] of Object.entries(byNPILoc)) {
    const [npi, loc] = key.split('||');
    const totalVisits = sum(grp, c => c.arrivedVisits);
    const uniquePatients = new Set(grp.map(c => c.patientName)).size;
    if (grp.length >= 2 && uniquePatients >= 2 && totalVisits === 0) {
      const hasScheduled = grp.some(c => c.dateOfFirstScheduledVisit !== null);
      alerts.push({
        physician: mode(grp.map(c => c.referringDoctor)),
        npi,
        location: loc.replace('Tristar PT - ', ''),
        evals: grp.length,
        uniquePatients,
        issue: hasScheduled ? 'Scheduling/No-Show' : 'Never Scheduled',
        estLostRev: Math.round(grp.length * 11.2 * DEFAULT_RPV),
      });
    }
  }

  return alerts.sort((a, b) => b.evals - a.evals);
}

function computeOTPT(physCases: RawCase[], years: number[]): OTPTRow[] {
  const results: OTPTRow[] = [];
  for (const yr of years) {
    const byLoc = groupBy(physCases.filter(c => c.year === yr), c => c.caseFacility);
    for (const [loc, grp] of Object.entries(byLoc)) {
      const pt = grp.filter(c => /PT|Physical/i.test(c.discipline)).length;
      const ot = grp.filter(c => /OT|Occupational/i.test(c.discipline)).length;
      results.push({
        year: yr,
        location: loc.replace('Tristar PT - ', ''),
        ptCases: pt,
        otCases: ot,
        otPct: pct(ot, grp.length),
      });
    }
  }
  return results;
}

function computePayerMix(physCases: RawCase[], years: number[]): PayerMixRow[] {
  const results: PayerMixRow[] = [];
  for (const yr of years) {
    const yrCases = physCases.filter(c => c.year === yr);
    const byPayer = groupBy(yrCases, c => c.primaryPayerType || 'Unknown');
    for (const [payer, grp] of Object.entries(byPayer)) {
      results.push({
        year: yr,
        payerType: payer,
        count: grp.length,
        pct: pct(grp.length, yrCases.length),
      });
    }
  }
  return results.sort((a, b) => b.count - a.count);
}

function computeLagAnalysis(physCases: RawCase[], years: number[]): LagAnalysisRow[] {
  const results: LagAnalysisRow[] = [];
  for (const yr of years) {
    const byLoc = groupBy(physCases.filter(c => c.year === yr), c => c.caseFacility);
    for (const [loc, grp] of Object.entries(byLoc)) {
      const createdToSched: number[] = [];
      const createdToEval: number[] = [];
      const schedToArrive: number[] = [];

      for (const c of grp) {
        if (c.createdDate && c.dateOfFirstScheduledVisit) {
          const days = diffDays(c.createdDate, c.dateOfFirstScheduledVisit);
          if (days >= 0 && days < 365) createdToSched.push(days);
        }
        if (c.createdDate && c.dateOfInitialEval) {
          const days = diffDays(c.createdDate, c.dateOfInitialEval);
          if (days >= 0 && days < 365) createdToEval.push(days);
        }
        if (c.dateOfFirstScheduledVisit && c.dateOfFirstArrivedVisit) {
          const days = diffDays(c.dateOfFirstScheduledVisit, c.dateOfFirstArrivedVisit);
          if (days >= 0 && days < 365) schedToArrive.push(days);
        }
      }

      results.push({
        year: yr,
        location: loc.replace('Tristar PT - ', ''),
        avgCreatedToSchedDays: rd(avg(createdToSched)),
        avgCreatedToEvalDays: rd(avg(createdToEval)),
        avgSchedToArriveDays: rd(avg(schedToArrive)),
        caseCount: grp.length,
      });
    }
  }
  return results;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
}

// ============================================================
// UTILITY
// ============================================================
function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : Math.floor(n);
}

function sum(arr: RawCase[], fn: (c: RawCase) => number): number {
  return arr.reduce((s, c) => s + fn(c), 0);
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

function rd(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = fn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function mode(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of arr) counts[s] = (counts[s] || 0) + 1;
  let best = '';
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) { best = k; bestCount = v; }
  }
  return best;
}
