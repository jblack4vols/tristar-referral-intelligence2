import { createClient } from '@supabase/supabase-js'
import type { RawCase, ProcessedData } from './dataEngine'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Database features will not work. Set these in your .env.local file.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

// ============================================================
// DB ROW TYPES
// ============================================================
interface DatasetRow {
  id: string
  year: number
  label: string
  start_date: string | null
  end_date: string | null
  file_name: string
  case_count: number
}

interface CaseRow {
  dataset_id: string
  patient_account_number: string
  patient_name: string
  case_therapist: string
  case_facility: string
  referring_doctor: string
  referring_doctor_npi: string
  referral_source: string
  primary_payer_type: string
  primary_insurance: string
  arrived_visits: number
  scheduled_visits: number
  created_date: string | null
  date_of_initial_eval: string | null
  discharge_date: string | null
  date_of_first_scheduled_visit: string | null
  date_of_first_arrived_visit: string | null
  discipline: string
  discharge_reason: string
  year: number
  is_physician: boolean
  is_uhc: boolean
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

export async function saveDataset(dataset: {
  year: number; label: string; startDate: string; endDate: string;
  fileName: string; caseCount: number;
}): Promise<DatasetRow> {
  // Check for existing dataset with same year
  const { data: existing } = await supabase
    .from('datasets')
    .select('id')
    .eq('year', dataset.year)
    .single()

  // Insert new dataset first (before deleting old) for safety
  const { data: newDs, error: insertError } = await supabase
    .from('datasets')
    .insert({
      year: dataset.year,
      label: dataset.label,
      start_date: dataset.startDate || null,
      end_date: dataset.endDate || null,
      file_name: dataset.fileName,
      case_count: dataset.caseCount,
    })
    .select()
    .single()

  if (insertError) throw insertError

  // Only delete old data after successful insert
  if (existing) {
    await supabase.from('cases').delete().eq('dataset_id', existing.id)
    await supabase.from('datasets').delete().eq('id', existing.id)
  }

  return newDs as DatasetRow
}

export async function saveCases(datasetId: string, cases: RawCase[]) {
  const BATCH = 500
  for (let i = 0; i < cases.length; i += BATCH) {
    const batch: Omit<CaseRow, 'id'>[] = cases.slice(i, i + BATCH).map(c => ({
      dataset_id: datasetId,
      patient_account_number: c.patientAccountNumber,
      patient_name: c.patientName,
      case_therapist: c.caseTherapist,
      case_facility: c.caseFacility,
      referring_doctor: c.referringDoctor,
      referring_doctor_npi: c.referringDoctorNPI,
      referral_source: c.referralSource,
      primary_payer_type: c.primaryPayerType,
      primary_insurance: c.primaryInsurance,
      arrived_visits: c.arrivedVisits,
      scheduled_visits: c.scheduledVisits,
      created_date: c.createdDate ? c.createdDate.toISOString().split('T')[0] : null,
      date_of_initial_eval: c.dateOfInitialEval ? c.dateOfInitialEval.toISOString().split('T')[0] : null,
      discharge_date: c.dischargeDate ? c.dischargeDate.toISOString().split('T')[0] : null,
      date_of_first_scheduled_visit: c.dateOfFirstScheduledVisit ? c.dateOfFirstScheduledVisit.toISOString().split('T')[0] : null,
      date_of_first_arrived_visit: c.dateOfFirstArrivedVisit ? c.dateOfFirstArrivedVisit.toISOString().split('T')[0] : null,
      discipline: c.discipline,
      discharge_reason: c.dischargeReason,
      year: c.year,
      is_physician: c.isPhysician,
      is_uhc: c.isUHC,
    }))

    const { error } = await supabase.from('cases').insert(batch)
    if (error) throw error
  }
}

export async function saveProcessedKPIs(data: ProcessedData) {
  // Delete old, keep latest
  await supabase.from('processed_kpis').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { error } = await supabase.from('processed_kpis').insert({ data })
  if (error) throw error
}

export async function loadDatasets(): Promise<DatasetRow[]> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .order('year', { ascending: true })
  if (error) throw error
  return (data || []) as DatasetRow[]
}

export async function loadCases(): Promise<CaseRow[]> {
  const allCases: CaseRow[] = []
  let from = 0
  const PAGE = 5000

  while (true) {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    allCases.push(...(data as CaseRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return allCases
}

export async function loadProcessedKPIs(): Promise<ProcessedData | null> {
  const { data, error } = await supabase
    .from('processed_kpis')
    .select('data')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return (data?.data as ProcessedData) || null
}

export async function deleteDataset(year: number) {
  const { data: ds } = await supabase
    .from('datasets')
    .select('id')
    .eq('year', year)
    .single()

  if (ds) {
    await supabase.from('cases').delete().eq('dataset_id', ds.id)
    await supabase.from('datasets').delete().eq('id', ds.id)
  }
}

// Convert DB row back to RawCase format for reprocessing
export function dbCaseToRawCase(c: CaseRow): RawCase {
  return {
    patientAccountNumber: c.patient_account_number || '',
    patientName: c.patient_name || '',
    caseTherapist: c.case_therapist || '',
    caseFacility: c.case_facility || '',
    referringDoctor: c.referring_doctor || '',
    referringDoctorNPI: c.referring_doctor_npi || '',
    referralSource: c.referral_source || '',
    primaryPayerType: c.primary_payer_type || '',
    primaryInsurance: c.primary_insurance || '',
    arrivedVisits: c.arrived_visits || 0,
    scheduledVisits: c.scheduled_visits || 0,
    createdDate: c.created_date ? new Date(c.created_date) : null,
    dateOfInitialEval: c.date_of_initial_eval ? new Date(c.date_of_initial_eval) : null,
    dischargeDate: c.discharge_date ? new Date(c.discharge_date) : null,
    dateOfFirstScheduledVisit: c.date_of_first_scheduled_visit ? new Date(c.date_of_first_scheduled_visit) : null,
    dateOfFirstArrivedVisit: c.date_of_first_arrived_visit ? new Date(c.date_of_first_arrived_visit) : null,
    discipline: c.discipline || '',
    dischargeReason: c.discharge_reason || '',
    year: c.year || 0,
    isPhysician: c.is_physician || false,
    isUHC: c.is_uhc || false,
  }
}
