# Recommendations Report — Security, PHI, & Improvements

**Date:** 2026-04-06 | **Branch:** claude/analyze-code-bIAie

---

## 1. PHI / HIPAA Concerns (HIGH PRIORITY)

### Patient Names in Supabase

The `cases` table stores `patient_name` in plaintext in Supabase cloud. This is Protected Health Information (PHI) under HIPAA. Combined with `referring_doctor`, `case_facility`, and dates, this creates identifiable patient records.

**Options (pick one):**
- **Remove patient names from DB** — only needed for zero-visit alert dedup (unique patient count). Replace with a hash: `patient_name_hash: sha256(patientName)`. Same dedup logic, no PHI stored.
- **Encrypt at rest** — use Supabase Vault or application-level encryption before insert.
- **Accept risk** — if this is an internal-only tool behind VPN/auth and Supabase project is properly locked down.

### No Authentication Layer

Anyone with the Vercel URL can:
- View all referral data
- Upload new datasets (overwriting existing years)
- Delete datasets

**Recommendations:**
- Add Supabase Auth (email/password for staff) — simplest option
- Or use Vercel password protection (Pro plan feature)
- At minimum, add RLS policies to Supabase tables requiring authenticated users

### Supabase RLS Status Unknown

The project is currently INACTIVE so can't verify. When reactivated:
```sql
-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

If RLS is disabled, anyone with the anon key can read/write all data. Enable RLS + add policies:
```sql
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_kpis ENABLE ROW LEVEL SECURITY;

-- Example: require authenticated users
CREATE POLICY "auth_only" ON datasets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON cases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON processed_kpis FOR ALL USING (auth.role() = 'authenticated');
```

### Supabase URL in README

`README.md` contains the Supabase project URL. Not a secret (anon key is designed for client-side), but remove it from README and rely on `.env.local` only.

---

## 2. Data Integrity (MEDIUM PRIORITY)

### processed_kpis Delete-All Pattern

`saveProcessedKPIs()` deletes ALL rows then inserts. Brief window with no cached data.

```ts
// Current: risky
await supabase.from('processed_kpis').delete().neq('id', '...')
await supabase.from('processed_kpis').insert({ data })
```

**Fix:** Use upsert or transaction:
```ts
// Better: insert first, then delete old
const { data: newRow } = await supabase.from('processed_kpis').insert({ data }).select('id').single()
if (newRow) await supabase.from('processed_kpis').delete().neq('id', newRow.id)
```

### No File Validation Beyond Extension

`handleFiles` only checks `.xlsx?` extension. A malicious file could cause XLSX parsing errors or memory issues.

**Recommendation:** Add file size limit (e.g., 50MB) and wrap parsing in try/catch with user-friendly errors (already done for parse errors, but no size check).

---

## 3. UX Improvements (LOW PRIORITY)

### Loading State After Data Exists

Dashboard shows `<TabSkeleton />` when `loading=true`, but by the time `data` is set, `loading` is already `false`. The skeleton only shows during initial load — correct behavior but the check at line 259 is redundant since `data` is already confirmed non-null at line 221.

### No Confirmation on Dataset Delete

Clicking "×" on a year badge immediately deletes data from Supabase with no confirmation. Add a `window.confirm()` or modal.

### Tab State Lost on Refresh

Tab state is URL-based (`?tab=kpi`) which is good, but the Payer Mix and Speed to Care tabs were just added. Bookmarks to these tabs will now work.

### Export Functionality

`exportUtils.ts` has CSV/Excel export but it's only used in `PhysiciansTab` and `AlertsTab`. Could extend to all tabs.

---

## 4. Performance (LOW PRIORITY)

### All Cases Loaded Into Memory

`processData()` processes all cases in-memory. For very large datasets (>100K cases), this could be slow. Current usage likely <10K cases per year, so this is fine for now.

### No Memoization of Processed Data

The `processData()` call happens on every upload/delete. The results are cached in state and Supabase, so this is fine. But if real-time filtering is added later, consider `useMemo` for filtered subsets.

---

## 5. Code Quality (LOW PRIORITY)

### `supabase.ts` Still 217 Lines

Could split into `supabase-client.ts` (client init) and `supabase-operations.ts` (CRUD). Low priority — file is well-organized with clear sections.

### `kpi-computation.ts` at 341 Lines

Over the 200-line target but all functions are tightly coupled through shared constants and utilities. Splitting would create artificial boundaries. Acceptable as-is.

---

## Priority Action Items

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 1 | Hash patient names before storing in Supabase | HIGH | 2hr |
| 2 | Add Supabase Auth + RLS policies | HIGH | 4hr |
| 3 | Remove Supabase URL from README | HIGH | 5min |
| 4 | Fix processed_kpis delete pattern | MEDIUM | 30min |
| 5 | Add file size limit on upload | MEDIUM | 15min |
| 6 | Add delete confirmation dialog | LOW | 15min |
| 7 | Extend export to all tabs | LOW | 2hr |

---

## Unresolved Questions

- Is this tool intended to be public-facing or internal-only? (Affects auth requirements)
- Are there HIPAA Business Associate Agreements in place with Supabase?
- Should patient-level data be stored at all, or only aggregated KPIs?
