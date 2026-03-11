import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tkgygnninsbzzwlobtff.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrZ3lnbm5pbnNienp3bG9idGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDQzNTcsImV4cCI6MjA4ODgyMDM1N30.mNrg6fZ0PjznBdLTB-xjLX21vyXGlnsLihpFJ0MsAmE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================
// DATABASE OPERATIONS
// ============================================================

export async function saveDataset(dataset: {
  year: number; label: string; startDate: string; endDate: string;
  fileName: string; caseCount: number;
}) {
  // Upsert — replace if same year exists
  const { data: existing } = await supabase
    .from('datasets')
    .select('id')
    .eq('year', dataset.year)
    .single()

  if (existing) {
    // Delete old cases first
    await supabase.from('cases').delete().eq('dataset_id', existing.id)
    await supabase.from('datasets').delete().eq('id', existing.id)
  }

  const { data, error } = await supabase
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

  if (error) throw error
  return data
}

export async function saveCases(datasetId: string, cases: any[]) {
  // Insert in batches of 500
  const BATCH = 500
  for (let i = 0; i < cases.length; i += BATCH) {
    const batch = cases.slice(i, i + BATCH).map(c => ({
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

export async function saveProcessedKPIs(data: any) {
  // Delete old, keep latest
  await supabase.from('processed_kpis').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { error } = await supabase.from('processed_kpis').insert({ data })
  if (error) throw error
}

export async function loadDatasets() {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .order('year', { ascending: true })
  if (error) throw error
  return data || []
}

export async function loadCases() {
  // Load all cases — paginate if needed
  const allCases: any[] = []
  let from = 0
  const PAGE = 5000

  while (true) {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    allCases.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return allCases
}

export async function loadProcessedKPIs() {
  const { data, error } = await supabase
    .from('processed_kpis')
    .select('data')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data?.data || null
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
