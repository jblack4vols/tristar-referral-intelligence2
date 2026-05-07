// Payer reimbursement rates, tier classifications, and defaults

/** Revenue-per-visit by payer type */
export const PAYER_RPV: Record<string, number> = {
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

/** Payer tier classification (A = best reimbursement, C = lowest) */
export const PAYER_TIERS: Record<string, string> = {
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

/** Default revenue-per-visit for unknown payer types */
export const DEFAULT_RPV = 95;

/** Average visits-per-eval across all historical data, used as fallback */
export const DEFAULT_VISITS_PER_EVAL = 11.2;

/** Keywords to detect UnitedHealthcare insurance */
export const UHC_KEYWORDS = ['UNITED', 'UHC', 'OPTUM'];
