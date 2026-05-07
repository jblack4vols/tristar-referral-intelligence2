// Barrel module — re-exports from modularized data engine files
// All existing imports from '@/lib/dataEngine' continue to work unchanged

export type {
  RawCase, DataSet, ProcessedData, AnnualKPI, MonthlyKPI,
  LocationKPI, PhysicianRanking, Alert, FunnelRow,
  ZeroVisitAlert, OTPTRow, PayerMixRow, LagAnalysisRow,
} from './data-types';

export { parseExcelFile } from './excel-parser';
export { processData } from './kpi-computation';
