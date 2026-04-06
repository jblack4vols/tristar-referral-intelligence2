// All KPI computation functions for the referral intelligence engine

import type {
  RawCase, DataSet, ProcessedData, AnnualKPI, MonthlyKPI,
  LocationKPI, PhysicianRanking, Alert, FunnelRow,
  ZeroVisitAlert, OTPTRow, PayerMixRow, LagAnalysisRow,
} from './data-types';
import { PAYER_RPV, PAYER_TIERS, DEFAULT_RPV, DEFAULT_VISITS_PER_EVAL } from './payer-constants';
import { sum, pct, rd, groupBy, mode, diffDays, avg } from './computation-utils';

// Main entry point: process all datasets into computed KPIs
export function processData(datasets: DataSet[]): ProcessedData {
  const allCases = datasets.flatMap(d => d.cases);
  const years = [...new Set(datasets.map(d => d.year))].sort();
  const physCases = allCases.filter(c => c.isPhysician);

  const sortedYears = [...years].sort((a, b) => a - b);
  const latestYear = sortedYears[sortedYears.length - 1];
  const priorYear = sortedYears.length > 1 ? sortedYears[sortedYears.length - 2] : null;

  return {
    datasets,
    annualKPIs: years.map(yr => computeAnnualKPI(allCases.filter(c => c.year === yr), yr)),
    monthlyKPIs: computeMonthlyKPIs(allCases),
    locationKPIs: computeLocationKPIs(allCases, years),
    physicianRankings: computePhysicianRankings(physCases, years),
    alerts: priorYear ? computeAlerts(physCases, priorYear, latestYear) : [],
    funnel: computeFunnel(physCases, years),
    zeroVisitAlerts: computeZeroVisitAlerts(physCases.filter(c => c.year === latestYear)),
    otPTSplit: computeOTPT(physCases, years),
    payerMix: computePayerMix(physCases, years),
    lagAnalysis: computeLagAnalysis(physCases, years),
  };
}

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
    uniquePhysicians: new Set(phys.map(c => c.referringDoctorNPI)).size,
    locations: new Set(cases.map(c => c.caseFacility)).size,
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
      yearData, totalEvals, totalVisits,
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

  const useQ1 = q1Latest.length > 0 && q1Prior.length > 0;
  const prior = useQ1 ? q1Prior : physCases.filter(c => c.year === priorYear);
  const latest = useQ1 ? q1Latest : physCases.filter(c => c.year === latestYear);

  const priorByNPILoc = groupBy(prior, c => `${c.referringDoctorNPI}||${c.caseFacility}`);
  const latestByNPILoc = groupBy(latest, c => `${c.referringDoctorNPI}||${c.caseFacility}`);
  const allKeys = new Set([...Object.keys(priorByNPILoc), ...Object.keys(latestByNPILoc)]);
  const alerts: Alert[] = [];

  // Full-year V/E for revenue estimation
  const fyPrior = physCases.filter(c => c.year === priorYear);
  const fyByNPI = groupBy(fyPrior, c => c.referringDoctorNPI);
  const npiVE: Record<string, number> = {};
  for (const [npi, grp] of Object.entries(fyByNPI)) {
    npiVE[npi] = sum(grp, c => c.arrivedVisits) / (grp.length || 1);
  }

  for (const key of allKeys) {
    const [npi, loc] = key.split('||');
    const pGrp = priorByNPILoc[key] || [];
    const lGrp = latestByNPILoc[key] || [];
    const ePrior = pGrp.length;
    const eLatest = lGrp.length;
    const name = mode([...pGrp, ...lGrp].map(c => c.referringDoctor));
    const ve = npiVE[npi] || DEFAULT_VISITS_PER_EVAL;

    let category = '';
    let pctChange: number | null = null;
    if (ePrior > 0) pctChange = rd(((eLatest - ePrior) / ePrior) * 100);

    if (ePrior >= 3 && eLatest === 0) category = 'Gone Dark';
    else if (ePrior >= 3 && eLatest > 0 && pctChange !== null && pctChange <= -50) category = 'Sharp Decline';
    else if (ePrior >= 3 && pctChange !== null && pctChange < -20 && pctChange > -50) category = 'Moderate Decline';
    else if (eLatest >= 2 && ePrior > 0 && pctChange !== null && pctChange >= 50) category = 'Rising Star';
    else if (ePrior === 0 && eLatest >= 3) category = 'New Relationship';

    if (category) {
      alerts.push({
        physician: name, npi,
        location: loc.replace('Tristar PT - ', ''),
        evalsOld: ePrior, evalsNew: eLatest, pctChange, category,
        estRevImpact: Math.round((eLatest - ePrior) * ve * DEFAULT_RPV),
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
        year: yr, location: loc.replace('Tristar PT - ', ''),
        created, scheduled, arrived, evalCompleted: evalDone, discharged: dc,
        schedRate: pct(scheduled, created), arriveRate: pct(arrived, created),
        evalRate: pct(evalDone, created), dcRate: pct(dc, created),
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
      alerts.push({
        physician: mode(grp.map(c => c.referringDoctor)),
        npi, location: loc.replace('Tristar PT - ', ''),
        evals: grp.length, uniquePatients,
        issue: grp.some(c => c.dateOfFirstScheduledVisit !== null) ? 'Scheduling/No-Show' : 'Never Scheduled',
        estLostRev: Math.round(grp.length * DEFAULT_VISITS_PER_EVAL * DEFAULT_RPV),
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
      results.push({
        year: yr, location: loc.replace('Tristar PT - ', ''),
        ptCases: grp.filter(c => /PT|Physical/i.test(c.discipline)).length,
        otCases: grp.filter(c => /OT|Occupational/i.test(c.discipline)).length,
        otPct: pct(grp.filter(c => /OT|Occupational/i.test(c.discipline)).length, grp.length),
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
      results.push({ year: yr, payerType: payer, count: grp.length, pct: pct(grp.length, yrCases.length) });
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
          const d = diffDays(c.createdDate, c.dateOfFirstScheduledVisit);
          if (d >= 0 && d < 365) createdToSched.push(d);
        }
        if (c.createdDate && c.dateOfInitialEval) {
          const d = diffDays(c.createdDate, c.dateOfInitialEval);
          if (d >= 0 && d < 365) createdToEval.push(d);
        }
        if (c.dateOfFirstScheduledVisit && c.dateOfFirstArrivedVisit) {
          const d = diffDays(c.dateOfFirstScheduledVisit, c.dateOfFirstArrivedVisit);
          if (d >= 0 && d < 365) schedToArrive.push(d);
        }
      }

      results.push({
        year: yr, location: loc.replace('Tristar PT - ', ''),
        avgCreatedToSchedDays: rd(avg(createdToSched)),
        avgCreatedToEvalDays: rd(avg(createdToEval)),
        avgSchedToArriveDays: rd(avg(schedToArrive)),
        caseCount: grp.length,
      });
    }
  }
  return results;
}
