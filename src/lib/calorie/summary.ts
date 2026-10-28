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

/**
 * DB の日付を YYYY-MM-DD にする。形式が違えば空。期間の突き合わせはこの形で行う。
 * calorie_period_stats と日次マップのキー。画面の日付も同じ形。
 * タイムゾーンの切り方を変えるなら jstDay。ここは文字列の先頭10文字。
 */
function asDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

/**
 * 表示用の丸め。places 桁で四捨五入する。摂取合計の切り捨ては、このあと truncKcal を別途かける。
 * 体重は 2 桁、散歩メートルは 1 桁。kcal の床（小数第1位切り捨て）は formula.ts。
 * 丸め桁の既定を変えるなら places。切り捨てと混ぜない。
 */
function num(value: unknown, places = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** places;
  return Math.round(parsed * factor) / factor;
}

/**
 * その日が属する週の月曜です。日曜は前の月曜に戻します。週の区切りを変えるならここです。
 * 週次の period_start とグラフの週ラベル。calorie_period_stats の週キーもこの月曜。
 * 週始まりを日曜にするなら diff の式。日次の7日窓とは別（WINDOW.day）。
 */
export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return shiftIsoDate(iso, diff);
}

/**
 * その月の1日です。月次の period_start に使います。
 * グラフの月の点と calorie_period_guides の開始日。
 * 月末は monthEnd。週の月曜は mondayOf。
 */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * その月の末日です。31日無い月もここで正しい最終日になります。
 * 月次の period_end。体重の点は期間内の最終計測（weightOnEnd）で、この日に無くても遡る。
 * 日数計算は inclusiveDays。ここは月末の日付だけ。
 */
export function monthEnd(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/**
 * その年の1月1日です。年次の始まりです。
 * calorie_period_stats の年と、full でない集計の読み始め（refreshDogStats）。
 * 年末は yearEnd。約5年の全再計算は shiftIsoDate の -5*366。
 */
export function yearStart(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

/**
 * その年の12月31日です。年次の終わりです。
 * 年の点の period_end。進行中の年は画面側が今日までに切る。
 * 翌年末までガイドを書く範囲は storePeriodGuides。
 */
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

/**
 * 週の軸ラベル。「M/D–M/D」。週の区切りそのものは mondayOf。
 * グラフの横軸。日次の「M/D」は describePeriod。
 * 文字の形を変えるならここ。週の保存キーは weekKey。
 */
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

/**
 * グラフに一度に出す件数です。日7・週12・月12・年5。今日画面の CHART_WINDOW も同じ数字にしてください。
 * 日次は直近7日。片方だけ変えると、読み込み幅と表示幅がずれます。
 * ページ送りの幅は画面の shiftChartEnd（日は14日）。ここは1画面の件数。
 */
export const WINDOW: Record<TrendGrain, number> = { day: 7, week: 12, month: 12, year: 5 };

/**
 * 期間を steps 個動かします。週は7日、月は月初め、年は1月1日、日は1日ずつです。
 * グラフの過去ページと periodList。右スワイプが過去（負の steps）。
 * 1ページの件数は WINDOW。今日より未来にしないのは shiftViewEnd。
 */
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

/**
 * asOf から過去へ、WINDOW 件（または from 以降）の期間を古い順に並べます。4000回で打ち切ります。
 * 日次なら直近7日が既定。グラフの点の並び。保存はしない。
 * 件数は WINDOW。打ち切り回数を変えるなら 4000。週の月曜は mondayOf。
 */
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
 * グラフの赤点（期末の体重）はここです。日次は「その日」だけ、週・月・年は期間の終わり側です。
 * 計測が無い期間は点を出しません。さかのぼり方を変えると、赤点が別の日の体重になります。
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

/**
 * 開始日から終了日までの kcal 合計です。結果は truncKcal（小数第1位で切り捨て、四捨五入ではない）です。
 * 週・月・年の線。日次は1日分をそのまま。平均にはしない。
 * 桁を変えるなら formula.ts の truncKcal。体重は weightOnEnd。
 */
export function kcalInRange(kcal: Map<string, number>, start: string, end: string): number {
  let total = 0;
  for (let cursor = start; cursor <= end; cursor = shiftIsoDate(cursor, 1)) {
    total += kcal.get(cursor) ?? 0;
    if (cursor === end) break;
  }
  return truncKcal(total);
}

/**
 * 日ごとの点を作ります。目安と散歩は後から attachGuides / attachWalks で足します。
 * 日次グラフは直近の日（既定7）。体重はその日の計測で、平均ではない。無い日は null。
 * 件数は periodList。点線はガイド行が無いと null。
 */
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

/**
 * computed_at を日本時間の日付にする。集計日が今日より前なら、画面は今日の kcal を足し直す。
 * calorie_period_stats の computed_at。進行中の週・月・年だけが足す。
 * タイムゾーンを変えるなら timeZone。日付の形は asDateKey。
 */
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

/**
 * 表示の終端から WINDOW 件ぶん遡った開始日です。件数が変わると、読み込む期間も変わります。
 * 日次は終端から6日前（7日分）。グラフの初回と過去ページの取得範囲。
 * 件数は WINDOW。終端を未来にしないのは呼び出し側。
 */
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
  /**
   * 進行中の1期間。マップが期間の開始まで届いていれば日次合計（truncKcal）。
   * 届いていなければ保存済み合計に、集計日が今日より前のときだけ今日の kcal を足す。
   * 体重は weightOnEnd（期間内で終了日に一番近い計測）。無ければ保存済みの期末体重。
   */
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
  /**
   * 終わった期間は calorie_period_stats の合計と期末体重をそのまま出す。進行中は currentPoint。
   * 体重は平均ではなく期末（保存済み weight_kg）。kcal は truncKcal 済みの合計。
   * 点線はここでは付けない。attachGuides。集計日の足し方は currentPoint。
   */
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

/**
 * 開始と終了を含む日数。目安 kcal = 1日の目標 × この日数。壊れた範囲は 1 日として扱う。
 * 点線（calorie_period_guides）の日数。書くのはプラン保存の storePeriodGuides。cron ではない。
 * 日数の切り捨ては truncKcal 側。ここは日数だけ。
 */
function inclusiveDays(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 1;
  return Math.round((to - from) / 86400000) + 1;
}

/**
 * from から to まで期間を進める。ガイドの一括作成が使う。4000 回で打ち切る。
 * storePeriodGuides が約5年前から翌年末まで回す。摂取の cron はここを使わない。
 * 粒度の区切りは describePeriod。打ち切りを変えるなら 4000。
 */
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
 * 1日の目標から、期間ごとの目安（guide_kcal = 目標 × 日数、小数第1位で切り捨て）を calorie_period_guides に書き込みます。
 * 範囲は約5年前から翌年末まで。プラン（プロフィール）保存の saveDogProfile から呼ばれ、グラフの点線が変わります。
 * 摂取の合計や期末体重はここでは書きません。それらは calorie_period_stats 側です。
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

/**
 * 期間中の散歩距離（メートル）の合計です。km への換算は attachWalks 側です。
 * グラフの茶色い棒の元。walk_logs を日付で足したもの。平均ではない。
 * km にするなら attachWalks の 1000。ここはメートルの合計だけ。
 */
export function metersInRange(meters: Map<string, number>, start: string, end: string): number {
  let total = 0;
  for (let cursor = start; cursor <= end; cursor = shiftIsoDate(cursor, 1)) {
    total += meters.get(cursor) ?? 0;
    if (cursor === end) break;
  }
  return total;
}

/**
 * 各点に散歩km（小数2桁）を付けます。0の日はグラフの棒が出ません。割る1000を変えると単位が変わります。
 * 茶色の棒。線は kcal、赤は体重、点線は目安。色は trend-chart。
 * 桁は小数2桁。メートルの合計は metersInRange。
 */
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

/**
 * 目安を「粒度:開始日」で引いて guideKcal にします。行が無い点は null（点線が途切れます）。
 * 点線の値。行はプラン保存の storePeriodGuides が書く。cron の再計算では作らない。
 * キーの形を変えるならここと loadVisibleChart の guideMap。
 */
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

/**
 * viewEnd 以前の点から、末尾 WINDOW 件だけ残します。グラフの1ページ分です。
 * 日次なら直近7日。今日画面と暮らし帳の windowedTrend と同じ切り方。
 * 件数は WINDOW。終端より未来の点は捨てる。
 */
export function windowTrends(points: DayTrend[], grain: TrendGrain, viewEnd: string): DayTrend[] {
  const visible = points.filter((point) => point.start <= viewEnd);
  return visible.slice(-WINDOW[grain]);
}

/**
 * 表示終端を WINDOW 件ぶん前後に動かします。今日より未来にはしません。
 * 画面のスワイプは 48px で onShift。右が過去。矢印はボタンではない。
 * 日の送り幅を画面側（14日）に合わせるなら shiftChartEnd。ここは WINDOW 件ぶん。
 */
export function shiftViewEnd(grain: TrendGrain, viewEnd: string, direction: -1 | 1, today: string): string {
  const next = shiftPeriod(grain, viewEnd, direction * WINDOW[grain]);
  if (next > today) return today;
  return next;
}

/**
 * 週・月・年だけ calorie_period_stats に upsert します。日次は保存せず、毎回 calorie_logs から計算します。
 * kcal_total は呼び元が truncKcal 済み。weight_kg は期末体重（weightOnEnd の結果）。
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
 * full でなければ今年の初めから読み、週・月・年の「いまの期間」1件だけ上書きします。期末体重もその期間分だけです。
 * full なら約5年（5×366日）を読み直し、全期間を calorie_period_stats に書き直します。cron の rebuildAllCalorieStats だけが full です。
 * 点線（calorie_period_guides）はここでは触りません。ガイドはプラン保存の storePeriodGuides です。
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
 * dogs の全頭について refreshDogStats(..., true) します。cron（/api/cron/calorie-summary）のカロリー部分です。
 * 頭ごとに約5年分を小数第1位切り捨てで作り直し、期末体重も保存し直します。ガイドの点線は作り直しません。
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
