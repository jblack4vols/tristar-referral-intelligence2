# Codebase Analysis Report — Tristar Referral Intelligence

**Date:** 2026-04-06 | **Branch:** claude/analyze-code-bIAie

---

## Project Overview

Next.js 14 + TypeScript dashboard for **Tristar PT** (physical therapy clinics). Ingests Excel exports from Prompt EMR ("Created Cases Reports"), computes referral intelligence KPIs, and persists data in Supabase. Deployed to Vercel.

**Stack:** Next.js 14 / React 18 / TypeScript / Tailwind CSS 3 / Recharts / Supabase / XLSX / Vitest

---

## Architecture Summary

```
src/
├── app/           # Next.js App Router (single page)
│   ├── page.tsx   # Wraps Dashboard in Suspense
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Dashboard.tsx          # 811 lines — main orchestrator (OVERSIZED)
│   ├── tabs/                  # 8 tab components (43-178 lines each)
│   │   ├── SummaryTab.tsx     # Executive summary dashboard
│   │   ├── KPITab.tsx         # KPI trend charts
│   │   ├── RevenueTab.tsx     # Revenue analytics
│   │   ├── PhysiciansTab.tsx  # Physician rankings table
│   │   ├── AlertsTab.tsx      # Physician alerts (gone dark, decline, etc.)
│   │   ├── FunnelTab.tsx      # Referral-to-discharge conversion funnel
│   │   ├── OTPTTab.tsx        # OT vs PT discipline split
│   │   └── LocationsTab.tsx   # Per-clinic breakdowns
│   └── shared/                # Reusable UI components
│       ├── Header.tsx, TabNav.tsx, UploadScreen.tsx
│       ├── Stat.tsx, AlertBadge.tsx, Skeleton.tsx
│       ├── ExportButton.tsx, ErrorToast.tsx
│       ├── PhysicianModal.tsx
│       └── constants.ts
└── lib/
    ├── dataEngine.ts   # 749 lines — Excel parser + all KPI computation
    ├── supabase.ts     # 218 lines — Supabase CRUD operations
    └── exportUtils.ts  # 51 lines — CSV/Excel export helpers
```

**Data flow:** Upload .xlsx -> `parseExcelFile()` -> `processData()` -> render tabs. Data persisted to Supabase (datasets, cases, processed_kpis tables). On reload, loads cached KPIs or recomputes from stored cases.

---

## Critical Issues (Must Fix)

### 1. Dashboard.tsx has 120 TypeScript compilation errors

The file has duplicate code from an incomplete refactoring:

- **Lines 7-8:** Duplicate imports of `DataSet` and `ProcessedData`
- **Lines 285 & 289:** Two destructuring of `data` — first without `payerMix`/`lagAnalysis`, second with them
- **Lines 294-300:** Redeclares `TABS` locally (already imported from `constants.ts`)
- **Lines 347-811:** Contains inline tab rendering code (Recharts charts, tables) that duplicates the extracted tab components. Recharts components (`ResponsiveContainer`, `AreaChart`, `LineChart`, etc.) are used but never imported.

**Root cause:** Partial refactoring extracted tab components into `src/components/tabs/` but left the old inline code in Dashboard.tsx. The extracted components (lines 327-344) render correctly; the dead code below (lines 347+) causes all compilation errors.

**Fix:** Remove lines 285, 294-300, and everything from line 347 onward (the dead inline rendering). Fix the duplicate import on lines 7-8.

### 2. No `next build` succeeds

Due to the TypeScript errors above, production builds fail. This means deployments to Vercel will fail.

---

## Code Quality Issues

### 3. Dashboard.tsx is 811 lines (target: <200)

Even after removing dead code, the file will still contain ~290 lines of state management, data loading, file upload handling, Supabase sync, and tab routing. Consider extracting:
- File upload logic into a custom hook (`useFileUpload`)
- Supabase data loading into a custom hook (`useDataLoader`)
- Autosave logic into a custom hook (`useAutosave`)

### 4. dataEngine.ts is 749 lines

Well-structured with clear sections, but exceeds the 200-line target. Could split into:
- `excel-parser.ts` — `parseExcelFile()` + date/number utilities
- `kpi-computation.ts` — all `compute*` functions + types
- `data-types.ts` — type/interface exports
- `payer-constants.ts` — `PAYER_RPV`, `PAYER_TIERS`, defaults

### 5. Dead code duplication in Dashboard.tsx

`Stat`, `AlertBadge`, `Delta`, `exportCSV`, and color constants (`O`, `P`, `BK`, etc.) are defined inline in Dashboard.tsx but also exist as extracted shared components. The inline versions are used by the dead code block.

### 6. `fmt`/`fmtN` formatting helpers defined inline

These are one-liners in Dashboard.tsx but may be useful across tabs. Low priority.

---

## Data & Business Logic Review

### dataEngine.ts — Sound Design

- **Payer RPV lookup** with 14 payer types + $95 default — reasonable
- **Payer tier classification** (A/B/C) drives Tier A% metric
- **Alert detection** is Q1-aligned when data permits, with 5 categories: Gone Dark, Sharp Decline, Moderate Decline, Rising Star, New Relationship
- **Zero-visit alerts** correctly flag physicians with 2+ unique patients and 0 arrived visits, distinguishing "Never Scheduled" vs "Scheduling/No-Show"
- **Lag analysis** tracks created-to-scheduled, created-to-eval, and scheduled-to-arrival days
- **Physician grouping** by NPI+location (same doctor at different clinics tracked separately) — correct

### supabase.ts — Solid with one concern

- Batch inserts (500 per batch) for cases — good
- Paginated loading (5000 per page) — good
- `saveDataset` inserts new then deletes old — prevents data loss on failure
- **Concern:** `saveProcessedKPIs` deletes ALL rows then inserts — brief window with no cached data. Not critical since it's just a cache.

---

## Test Coverage

- **25 tests, all passing** covering: annual KPIs, alerts (Gone Dark, New Relationship, Sharp Decline), monthly KPIs, location KPIs, physician rankings, funnel, zero-visit alerts, OT/PT split, payer mix, multi-year
- Tests cover `dataEngine.ts` only — no component tests, no Supabase integration tests
- Good edge case coverage (empty datasets, unknown payer types, same-patient dedup)

---

## Security Observations

- Supabase anon key exposed in README (intended for client-side, but should rely on RLS)
- No auth layer — anyone with the URL can view/upload data (acceptable for internal tool?)
- Patient names stored in Supabase — PHI/HIPAA consideration
- No input sanitization on Excel parsing beyond basic string trimming

---

## Summary

| Area | Status |
|------|--------|
| **Build** | BROKEN — 120 TS errors from dead code |
| **Tests** | 25/25 passing |
| **Data engine** | Solid, well-tested |
| **Supabase layer** | Functional, minor cache concern |
| **UI components** | Partially refactored; extracted tabs work, dead inline code remains |
| **File sizes** | Dashboard.tsx (811L) and dataEngine.ts (749L) exceed 200L target |

### Priority Actions

1. **Fix Dashboard.tsx** — remove dead code, fix duplicate imports (restores build)
2. **Modularize dataEngine.ts** — split into 3-4 focused modules
3. **Extract Dashboard hooks** — file upload, data loading, autosave
4. **Add component tests** — at minimum for Dashboard upload/load flow
5. **Review PHI handling** — patient names in cloud database

---

## Unresolved Questions

- Is there intentional Payer Mix or Speed to Care tab rendering? The extracted tab components don't include these, but the dead code references them.
- Are there RLS policies on the Supabase tables to protect patient data?
- Is the Q1 alignment (Jan 1 - Mar 9) in alerts intentional, or should it be Jan 1 - Mar 31?
