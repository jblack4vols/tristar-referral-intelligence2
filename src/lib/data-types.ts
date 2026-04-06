// All shared types/interfaces for the referral intelligence data engine

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
