// Parses Prompt EMR .xlsx exports into DataSet format

import * as XLSX from 'xlsx';
import type { RawCase, DataSet } from './data-types';
import { UHC_KEYWORDS } from './payer-constants';
import { parseDate, toNum, fmtDate } from './computation-utils';

export function parseExcelFile(buffer: ArrayBuffer, fileName: string): DataSet {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

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

    cases.push({
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
    });
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
