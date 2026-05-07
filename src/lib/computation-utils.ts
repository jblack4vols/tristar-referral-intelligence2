// Shared utility functions used across the data engine modules

import type { RawCase } from './data-types';

export function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d;
}

export function toNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : Math.floor(n);
}

export function sum(arr: RawCase[], fn: (c: RawCase) => number): number {
  return arr.reduce((s, c) => s + fn(c), 0);
}

/** Percentage rounded to one decimal: pct(2, 3) => 66.7 */
export function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

/** Round to 2 decimal places */
export function rd(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = fn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/** Returns the most frequent string in an array */
export function mode(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of arr) counts[s] = (counts[s] || 0) + 1;
  let best = '';
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) { best = k; bestCount = v; }
  }
  return best;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
}
