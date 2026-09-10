import type { Sql } from "@/lib/db";
import { shiftIsoDate, todayJst } from "./formula";
import type { DayTrend, TrendGrain } from "./types";
function asDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function num(value: unknown, places = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** places;
  return Math.round(parsed * factor) / factor;
}

export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return shiftIsoDate(iso, diff);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function yearStart(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

export function yearEnd(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`;
}

export function weekKey(iso: string): string {
  const monday = mondayOf(iso);
  const thursday = shiftIsoDate(monday, 3);
  const year = thursday.slice(0, 4);
  const week1 = mondayOf(`${year}-01-04`);
  const weeks = Math.round((Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${week1}T00:00:00Z`)) / 604800000) + 1;
  return `${year}-W${String(weeks).padStart(2, "0")}`;
}

function weekLabel(start: string, end: string): string {
  const a = `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))}`;
  const b = `${Number(end.slice(5, 7))}/${Number(end.slice(8, 10))}`;
  return `${a}–${b}`;
}

export function describePeriod(grain: TrendGrain, asOf: string): {
  key: string;
  start: string;
  end: string;
  label: string;
} {
  if (grain === "week") {
    const start = mondayOf(asOf);
    const end = shiftIsoDate(start, 6);
    return { key: weekKey(asOf), start, end, label: weekLabel(start, end) };
  }
  if (grain === "month") {
    const start = monthStart(asOf);
    const end = monthEnd(asOf);
    return {
      key: start.slice(0, 7),
      start,
      end,
      label: `${Number(start.slice(0, 4))}年${Number(start.slice(5, 7))}月`,
    };
  }
  if (grain === "year") {
    const start = yearStart(asOf);
    const end = yearEnd(asOf);
    return { key: start.slice(0, 4), start, end, label: `${start.slice(0, 4)}年` };
  }
  return { key: asOf, start: asOf, end: asOf, label: `${Number(asOf.slice(5, 7))}/${Number(asOf.slice(8, 10))}` };
}

function shiftPeriod(grain: TrendGrain, asOf: string, steps: number): string {
  if (grain === "week") return shiftIsoDate(mondayOf(asOf), steps * 7);
  if (grain === "month") {
    const [year, month] = asOf.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + steps, 1));
    return date.toISOString().slice(0, 10);
  }
  if (grain === "year") {
    const year = Number(asOf.slice(0, 4)) + steps;
    return `${year}-01-01`;
  }
  return shiftIsoDate(asOf, steps);
}

const COUNTS: Record<TrendGrain, number> = { day: 14, week: 12, month: 12, year: 5 };

export function periodList(grain: TrendGrain, asOf: string) {
  const count = COUNTS[grain];
  const items = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    items.push(describePeriod(grain, shiftPeriod(grain, asOf, -i)));
  }
  return items;
}

export function weightOnEnd(
  weights: Map<string, number>,
  start: string,
  end: string,
): number | null {
  if (weights.has(end)) return weights.get(end) ?? null;
  for (let cursor = end; cursor >= start; cursor = shiftIsoDate(cursor, -1)) {
    const value = weights.get(cursor);
    if (value != null) return value;
    if (cursor === start) break;
  }
  return null;
}

export function kcalInRange(kcal: Map<string, number>, start: string, end: string): number {
  let total = 0;
  for (let cursor = start; cursor <= end; cursor = shiftIsoDate(cursor, 1)) {
    total += kcal.get(cursor) ?? 0;
    if (cursor === end) break;
  }
  return Math.round(total * 10) / 10;
}

export function buildTrends(
  kcal: Map<string, number>,
  weights: Map<string, number>,
  asOf: string,
): Record<TrendGrain, DayTrend[]> {
  const grains: TrendGrain[] = ["day", "week", "month", "year"];
  const out = {} as Record<TrendGrain, DayTrend[]>;
  for (const grain of grains) {
    out[grain] = periodList(grain, asOf).map((period) => ({
      date: period.end > asOf ? asOf : period.end,
      label: period.label,
      start: period.start,
      end: period.end,
      kcal: kcalInRange(kcal, period.start, period.end > asOf ? asOf : period.end),
      weightKg: weightOnEnd(weights, period.start, period.end > asOf ? asOf : period.end),
    }));
  }
  return out;
}

type DayRow = { log_date: unknown; total: unknown };
type WeightRow = { log_date: unknown; weight_kg: unknown };

export async function loadDayMaps(sql: Sql, userId: string, dogId: number, from: string, to: string) {
  const [sums, weights] = await Promise.all([
    sql<DayRow>`
      select log_date, coalesce(sum(kcal), 0) as total
      from calorie_logs
      where user_id = ${userId} and dog_id = ${dogId}
        and log_date >= ${from} and log_date <= ${to}
      group by log_date
    `,
    sql<WeightRow>`
      select log_date, weight_kg
      from dog_weight_logs
      where user_id = ${userId} and dog_id = ${dogId}
        and log_date >= ${from} and log_date <= ${to}
    `,
  ]);
  const kcal = new Map<string, number>();
  for (const row of sums) {
    const key = asDateKey(row.log_date);
    if (key) kcal.set(key, num(row.total));
  }
  const kg = new Map<string, number>();
  for (const row of weights) {
    const key = asDateKey(row.log_date);
    if (key) kg.set(key, num(row.weight_kg, 2));
  }
  return { kcal, kg };
}

export async function persistTrends(
  sql: Sql,
  userId: string,
  dogId: number,
  trends: Record<TrendGrain, DayTrend[]>,
) {
  const grains: TrendGrain[] = ["week", "month", "year"];
  for (const grain of grains) {
    for (const point of trends[grain]) {
      const meta = describePeriod(grain, point.start);
      await sql`
        insert into calorie_period_stats (
          user_id, dog_id, period_type, period_key, period_start, period_end, kcal_total, weight_kg, computed_at
        )
        values (
          ${userId},
          ${dogId},
          ${grain},
          ${meta.key},
          ${point.start},
          ${point.end},
          ${point.kcal},
          ${point.weightKg},
          now()
        )
        on conflict (dog_id, period_type, period_key) do update set
          period_start = excluded.period_start,
          period_end = excluded.period_end,
          kcal_total = excluded.kcal_total,
          weight_kg = excluded.weight_kg,
          computed_at = now()
      `;
    }
  }
}

export async function refreshDogStats(sql: Sql, userId: string, dogId: number, asOf = todayJst()) {
  const from = shiftIsoDate(asOf, -5 * 366);
  const { kcal, kg } = await loadDayMaps(sql, userId, dogId, from, asOf);
  const trends = buildTrends(kcal, kg, asOf);
  await persistTrends(sql, userId, dogId, trends);
  return trends;
}

export async function rebuildAllCalorieStats(sql: Sql) {
  const dogs = await sql<{ id: number; user_id: string }>`select id, user_id from dogs`;
  let count = 0;
  for (const dog of dogs) {
    await refreshDogStats(sql, dog.user_id, dog.id);
    count += 1;
  }
  return { dogs: count, asOf: todayJst() };
}
