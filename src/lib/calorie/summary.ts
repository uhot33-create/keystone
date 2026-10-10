/**
 * カロリーの期間集計です。api.ts のグラフと、記録保存後の更新、
 * cron（/api/cron/calorie-summary）の全頭再計算がここを使います。
 * グラフに出す件数は WINDOW（日7・週12・月12・年5）です。今日画面の CHART_WINDOW も同じ数字です。
 * 目安の点線は calorie_period_guides、週・月・年の確定合計は calorie_period_stats です。
 * 元データは calorie_logs（kcal）と dog_weight_logs（体重）。週の始まりは月曜です。
 * guide_kcal は「1日の目標 × その期間の日数」。目標を変えて保存すると作り直します。
 */
import type { Sql } from "@/lib/db";
import { shiftIsoDate, todayJst, truncKcal } from "./formula";
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

/** その日が属する週の月曜です。日曜は前の月曜に戻します。週の区切りを変えるならここです。 */
export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return shiftIsoDate(iso, diff);
}

/** その月の1日です。月次の period_start に使います。 */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** その月の末日です。31日無い月もここで正しい最終日になります。 */
export function monthEnd(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** その年の1月1日です。年次の始まりです。 */
export function yearStart(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

/** その年の12月31日です。年次の終わりです。 */
export function yearEnd(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`;
}

/**
 * 週の保存キー（例: 2026-W41）です。calorie_period_stats の period_key になります。
 * 計算を変えると、同じ週が別キーになり、上書きされず行が増えます。
 */
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

/**
 * 粒度ごとの key / 開始日 / 終了日 / 軸の文言です。label を変えるとグラフの横軸の文字が変わります。
 * 週は月曜〜日曜、月は「2026年10月」、年は「2026年」、日は「10/10」です。
 */
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

/** グラフに一度に出す件数です。日7・週12・月12・年5。今日画面の CHART_WINDOW も同じ数字にしてください。 */
export const WINDOW: Record<TrendGrain, number> = { day: 7, week: 12, month: 12, year: 5 };

/** 期間を steps 個動かします。週は7日、月は月初め、年は1月1日、日は1日ずつです。 */
export function shiftPeriod(grain: TrendGrain, asOf: string, steps: number): string {
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

/** asOf から過去へ、WINDOW 件（または from 以降）の期間を古い順に並べます。4000回で打ち切ります。 */
export function periodList(grain: TrendGrain, asOf: string, from?: string) {
  const bound = from ?? shiftPeriod(grain, asOf, -(WINDOW[grain] - 1));
  const items = [];
  let cursor = asOf;
  for (let i = 0; i < 4000; i += 1) {
    const period = describePeriod(grain, cursor);
    if (period.end < bound && period.start < bound) break;
    items.push(period);
    const prev = shiftPeriod(grain, period.start, -1);
    if (prev >= period.start) break;
    cursor = prev;
  }
  return items.reverse();
}

/**
 * 期間内で、終了日に一番近い体重です。終了日が無ければ前日へ遡ります。無ければ null。
 * グラフの赤点（期末の体重）はここです。
 */
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

/** 開始日から終了日までの kcal 合計です。結果は truncKcal（小数第1位で切り捨て）です。 */
export function kcalInRange(kcal: Map<string, number>, start: string, end: string): number {
  let total = 0;
  for (let cursor = start; cursor <= end; cursor = shiftIsoDate(cursor, 1)) {
    total += kcal.get(cursor) ?? 0;
    if (cursor === end) break;
  }
  return truncKcal(total);
}

/** 日ごとの点を作ります。目安と散歩は後から attachGuides / attachWalks で足します。 */
export function buildDaySeries(
  kcal: Map<string, number>,
  weights: Map<string, number>,
  asOf: string,
  from: string,
): DayTrend[] {
  return periodList("day", asOf, from).map((period) => ({
    date: period.start,
    label: period.label,
    start: period.start,
    end: period.end,
    kcal: kcal.get(period.start) ?? 0,
    guideKcal: null,
    weightKg: weights.get(period.start) ?? null,
    walkKm: 0,
  }));
}

type StatRow = {
  period_type: string;
  period_start: unknown;
  period_end: unknown;
  kcal_total: unknown;
  weight_kg: unknown;
  computed_at?: unknown;
};

function jstDay(value: unknown): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }
  return asDateKey(value);
}

/** 表示の終端から WINDOW 件ぶん遡った開始日です。件数が変わると、読み込む期間も変わります。 */
export function chartWindowStart(grain: TrendGrain, viewEnd: string): string {
  if (grain === "day") return shiftIsoDate(viewEnd, -(WINDOW.day - 1));
  if (grain === "week") return mondayOf(shiftIsoDate(viewEnd, -(WINDOW.week - 1) * 7));
  if (grain === "month") return monthStart(shiftPeriod("month", viewEnd, -(WINDOW.month - 1)));
  return yearStart(shiftPeriod("year", viewEnd, -(WINDOW.year - 1)));
}

/**
 * 画面に出す系列です。日は日次マップ、週・月・年は calorie_period_stats。
 * 進行中の期間は、集計日が今日より前なら todayKcal を足します。終わった期間は保存済みの合計のままです。
 */
export function trendsForDisplay(
  kcal: Map<string, number>,
  weights: Map<string, number>,
  stats: StatRow[],
  asOf: string,
  dayFrom: string,
  options?: { todayKcal?: number; mapsFrom?: string },
): Record<TrendGrain, DayTrend[]> {
  const todayKcal = options?.todayKcal ?? 0;
  const mapsFrom = options?.mapsFrom ?? dayFrom;
  function currentPoint(grain: Exclude<TrendGrain, "day">, rows: StatRow[]): DayTrend {
    const period = describePeriod(grain, asOf);
    const end = period.end > asOf ? asOf : period.end;
    const row = rows.find((item) => asDateKey(item.period_start) === period.start);
    let pointKcal = 0;
    if (mapsFrom <= period.start) pointKcal = kcalInRange(kcal, period.start, end);
    else if (row) {
      pointKcal = truncKcal(num(row.kcal_total));
      const computed = jstDay(row.computed_at);
      if (!computed || computed < asOf) pointKcal = truncKcal(pointKcal + todayKcal);
    } else pointKcal = todayKcal;
    const weighed = weightOnEnd(weights, period.start, end);
    return {
      date: end,
      label: period.label,
      start: period.start,
      end: period.end,
      kcal: pointKcal,
      guideKcal: null,
      weightKg: weighed ?? (row?.weight_kg == null ? null : num(row.weight_kg, 2)),
      walkKm: 0,
    };
  }
  function fromStats(grain: Exclude<TrendGrain, "day">): DayTrend[] {
    const rows = stats.filter((row) => row.period_type === grain);
    const current = currentPoint(grain, rows);
    const closed: DayTrend[] = [];
    for (const row of rows) {
      const start = asDateKey(row.period_start);
      const end = asDateKey(row.period_end);
      if (!start || !end || end >= asOf || start === current.start) continue;
      const period = describePeriod(grain, start);
      closed.push({
        date: end,
        label: period.label,
        start,
        end: period.end,
        kcal: truncKcal(num(row.kcal_total)),
        guideKcal: null,
        weightKg: row.weight_kg == null ? null : num(row.weight_kg, 2),
        walkKm: 0,
      });
    }
    return [...closed, current].sort((a, b) => a.start.localeCompare(b.start));
  }
  return {
    day: buildDaySeries(kcal, weights, asOf, dayFrom),
    week: fromStats("week"),
    month: fromStats("month"),
    year: fromStats("year"),
  };
}

/**
 * 日次マップから日・週・月・年を全部組み直します。保存はしません。
 * cron の全再計算と、記録保存後の refreshDogStats がこれを使います。
 */
export function buildTrends(
  kcal: Map<string, number>,
  weights: Map<string, number>,
  asOf: string,
  from?: string,
): Record<TrendGrain, DayTrend[]> {
  const grains: TrendGrain[] = ["day", "week", "month", "year"];
  const out = {} as Record<TrendGrain, DayTrend[]>;
  for (const grain of grains) {
    out[grain] = periodList(grain, asOf, from).map((period) => {
      const end = period.end > asOf ? asOf : period.end;
      return {
        date: end,
        label: period.label,
        start: period.start,
        end: period.end,
        kcal: grain === "day" ? (kcal.get(period.start) ?? 0) : kcalInRange(kcal, period.start, end),
        guideKcal: null,
        weightKg:
          grain === "day" ? (weights.get(period.start) ?? null) : weightOnEnd(weights, period.start, end),
        walkKm: 0,
      };
    });
  }
  return out;
}

function inclusiveDays(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 1;
  return Math.round((to - from) / 86400000) + 1;
}

function periodsThrough(grain: TrendGrain, from: string, to: string) {
  const items = [];
  let cursor = from;
  for (let i = 0; i < 4000 && cursor <= to; i += 1) {
    const period = describePeriod(grain, cursor);
    items.push(period);
    const next = shiftPeriod(grain, period.start, 1);
    if (next <= cursor) break;
    cursor = period.end < next ? next : shiftIsoDate(period.end, 1);
  }
  return items;
}

/**
 * 1日の目標から、期間ごとの目安（guide_kcal = 目標 × 日数）を calorie_period_guides に書き込みます。
 * 範囲は約5年前から翌年末まで。目標を変えてプロフィールを保存したときに呼ばれ、グラフの点線が変わります。
 */
export async function storePeriodGuides(sql: Sql, userId: string, dogId: number, dailyKcal: number, asOf = todayJst()) {
  const from = shiftIsoDate(asOf, -5 * 366);
  const through = `${Number(asOf.slice(0, 4)) + 1}-12-31`;
  const grains: TrendGrain[] = ["day", "week", "month", "year"];
  const types: string[] = [];
  const keys: string[] = [];
  const starts: string[] = [];
  const ends: string[] = [];
  const guides: number[] = [];
  for (const grain of grains) {
    for (const period of periodsThrough(grain, from, through)) {
      types.push(grain);
      keys.push(period.key);
      starts.push(period.start);
      ends.push(period.end);
      guides.push(truncKcal(dailyKcal * inclusiveDays(period.start, period.end)));
    }
  }
  await sql.query(
    `insert into calorie_period_guides (
       user_id, dog_id, period_type, period_key, period_start, period_end, guide_kcal, updated_at
     )
     select $1, $2, period_type, period_key, period_start, period_end, guide_kcal, now()
     from unnest($3::text[], $4::text[], $5::date[], $6::date[], $7::numeric[])
       as u(period_type, period_key, period_start, period_end, guide_kcal)
     on conflict (dog_id, period_type, period_key) do update set
       period_start = excluded.period_start,
       period_end = excluded.period_end,
       guide_kcal = excluded.guide_kcal,
       updated_at = now()`,
    [userId, dogId, types, keys, starts, ends, guides],
  );
}

/** 期間中の散歩距離（メートル）の合計です。km への換算は attachWalks 側です。 */
export function metersInRange(meters: Map<string, number>, start: string, end: string): number {
  let total = 0;
  for (let cursor = start; cursor <= end; cursor = shiftIsoDate(cursor, 1)) {
    total += meters.get(cursor) ?? 0;
    if (cursor === end) break;
  }
  return total;
}

/** 各点に散歩km（小数2桁）を付けます。0の日はグラフの棒が出ません。割る1000を変えると単位が変わります。 */
export function attachWalks(trends: Record<TrendGrain, DayTrend[]>, meters: Map<string, number>) {
  const grains: TrendGrain[] = ["day", "week", "month", "year"];
  const out = {} as Record<TrendGrain, DayTrend[]>;
  for (const grain of grains) {
    out[grain] = trends[grain].map((point) => ({
      ...point,
      walkKm: Math.round((metersInRange(meters, point.start, point.end) / 1000) * 100) / 100,
    }));
  }
  return out;
}

/** 目安を「粒度:開始日」で引いて guideKcal にします。行が無い点は null（点線が途切れます）。 */
export function attachGuides(trends: Record<TrendGrain, DayTrend[]>, guides: Map<string, number>) {
  const grains: TrendGrain[] = ["day", "week", "month", "year"];
  const out = {} as Record<TrendGrain, DayTrend[]>;
  for (const grain of grains) {
    out[grain] = trends[grain].map((point) => ({
      ...point,
      guideKcal: guides.get(`${grain}:${point.start}`) ?? null,
    }));
  }
  return out;
}

type DayRow = { log_date: unknown; total: unknown };
type WeightRow = { log_date: unknown; weight_kg: unknown };

/**
 * from〜to の calorie_logs 合計と dog_weight_logs を、日付→数値の Map にします。
 * kcal は truncKcal、体重は小数2桁です。
 */
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
    if (key) kcal.set(key, truncKcal(num(row.total)));
  }
  const kg = new Map<string, number>();
  for (const row of weights) {
    const key = asDateKey(row.log_date);
    if (key) kg.set(key, num(row.weight_kg, 2));
  }
  return { kcal, kg };
}

/** viewEnd 以前の点から、末尾 WINDOW 件だけ残します。グラフの1ページ分です。 */
export function windowTrends(points: DayTrend[], grain: TrendGrain, viewEnd: string): DayTrend[] {
  const visible = points.filter((point) => point.start <= viewEnd);
  return visible.slice(-WINDOW[grain]);
}

/** 表示終端を WINDOW 件ぶん前後に動かします。今日より未来にはしません。 */
export function shiftViewEnd(grain: TrendGrain, viewEnd: string, direction: -1 | 1, today: string): string {
  const next = shiftPeriod(grain, viewEnd, direction * WINDOW[grain]);
  if (next > today) return today;
  return next;
}

/**
 * 週・月・年だけ calorie_period_stats に upsert します。日次は保存せず、毎回 calorie_logs から計算します。
 * computed_at は now()。この時刻が今日より前だと、画面側が今日のkcalを足し直します。
 */
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

/**
 * 記録の追加・削除・体重保存のあとに呼ぶ集計です。
 * full でなければ今年の初めから読み、週・月・年の「いまの期間」1件だけ上書きします。
 * full なら約5年（5×366日）を読み直し、全期間を calorie_period_stats に書き直します。cron は full です。
 */
export async function refreshDogStats(
  sql: Sql,
  userId: string,
  dogId: number,
  asOf = todayJst(),
  full = false,
) {
  const from = full ? shiftIsoDate(asOf, -5 * 366) : yearStart(asOf);
  const { kcal, kg } = await loadDayMaps(sql, userId, dogId, from, asOf);
  const trends = buildTrends(kcal, kg, asOf, from);
  if (full) {
    await persistTrends(sql, userId, dogId, trends);
    return trends;
  }
  const current = {
    day: [] as DayTrend[],
    week: trends.week.slice(-1),
    month: trends.month.slice(-1),
    year: trends.year.slice(-1),
  } satisfies Record<TrendGrain, DayTrend[]>;
  await persistTrends(sql, userId, dogId, current);
  return trends;
}

/**
 * dogs の全頭について refreshDogStats(..., true) します。cron のカロリー部分です。
 * 戻り値は処理した頭数と基準日。頭数が多いと、この1回が長くなります。
 */
export async function rebuildAllCalorieStats(sql: Sql) {
  const dogs = await sql<{ id: number; user_id: string }>`select id, user_id from dogs`;
  let count = 0;
  for (const dog of dogs) {
    await refreshDogStats(sql, dog.user_id, dog.id, todayJst(), true);
    count += 1;
  }
  return { dogs: count, asOf: todayJst() };
}
