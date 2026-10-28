/**
 * カロリー画面のサーバー処理です。/calorie と各パネルがここを呼んで、
 * 犬・フード・定番・その日の記録・体重・グラフを読み書きします。
 * 触りやすいところ: テーブル名（dogs, dog_foods, calorie_staples, calorie_logs,
 * dog_weight_logs, calorie_period_guides, calorie_period_stats, walk_logs）と、
 * 後半の zod の上限（名前の長さ、kcal、おやつ割合 0〜0.3、犬は10頭まで）。
 * 定番の並びは calorie_staples.sort_order（小さいほど先）。新規は最大値+1です。
 * 体重の計測時刻は measuredAt20 で、その日の20:00（日本時間）として保存します。
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assertCalorieEditable, dailyEnergy, isLifeStageId, todayJst, truncKcal } from "./formula";
import { DEFAULT_DOG_PORTRAIT, DEFAULT_PERSON_PORTRAIT, isDogPortrait, isPersonPortrait } from "./portraits";
import { attachGuides, attachWalks, buildDaySeries, chartWindowStart, loadDayMaps, refreshDogStats, storePeriodGuides, trendsForDisplay } from "./summary";
import type { CalorieLog, CalorieState, DayTrend, DogCare, DogMedicine, DogProfile, FoodKind, HouseholdDogDay, LogKind, TrendGrain } from "./types";

/**
 * 数値を places 桁で四捨五入する。摂取kcalの切り捨てはこちらではなく truncKcal。体重は 2 桁。
 * dogs と dog_weight_logs の読み戻し。画面の合計は小数第1位で切り捨て。
 * 体重の桁を変えるなら places=2 の呼び出し。kcal の床は formula.ts。
 */
function num(value: unknown, places = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** places;
  return Math.round(parsed * factor) / factor;
}

/**
 * dog_foods.kind。treat 以外はごはん（food）として扱う。
 * フードタブと今日画面のチップ。記録の other は asLogKind。
 * 種類を足すなら FoodKind と画面の選択肢も揃える。
 */
function asKind(value: string): FoodKind {
  return value === "treat" ? "treat" : "food";
}

/**
 * calorie_logs.kind。food / treat 以外は other（手入力）。
 * 今日画面の記録行。表示ラベルは treat 以外をごはんにする。
 * 種類を足すなら LogKind と addLogInput の zod。
 */
function asLogKind(value: string): LogKind {
  if (value === "food" || value === "treat") return value;
  return "other";
}

/**
 * zod を通し、最初のエラーメッセージを投げる。文言を変えるときは各スキーマ側。
 * 各 createServerFn の validator。画面はその文言をそのまま出す。
 * 共通の「入力内容を確認してください」を変えるならここ。
 */
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  }
  return result.data;
}

type DogRow = {
  id: number;
  name: string;
  current_weight_kg: unknown;
  ideal_weight_kg: unknown;
  life_stage: string;
  treat_ratio: unknown;
  portrait_id: string | null;
};

type FoodRow = {
  id: number;
  name: string;
  kind: string;
  kcal: unknown;
  amount: unknown;
  unit: string;
};

type LogRow = {
  id: number;
  log_date: string;
  label: string;
  kcal: unknown;
  kind: string;
  food_id: number | null;
  amount: unknown;
  unit: string | null;
};

/**
 * dogs の1行を画面用にする。体重は小数2桁。おやつ割合が 0 なら 10% に戻す。
 * 絵が不明なら初期の犬（portraits.ts の DEFAULT_DOG_PORTRAIT）。
 * ステージ不明は adult_neutered。id の正否は isDogPortrait。
 */
function mapDog(row: DogRow): DogProfile {
  return {
    id: row.id,
    name: row.name,
    currentWeightKg: num(row.current_weight_kg, 2),
    idealWeightKg: num(row.ideal_weight_kg, 2),
    lifeStage: isLifeStageId(row.life_stage) ? row.life_stage : "adult_neutered",
    treatRatio: num(row.treat_ratio, 2) || 0.1,
    portraitId: row.portrait_id && isDogPortrait(row.portrait_id) ? row.portrait_id : DEFAULT_DOG_PORTRAIT,
  };
}

/**
 * このユーザーの犬を id 順で全部返す。0頭なら空。並びを変えると切り替えの先頭も変わる。
 * 今日画面の犬切り替えとプロフィール。テーブルは dogs。
 * 並びを変えるなら order by。先頭の選択は pickDog。
 */
async function listDogs(userId: string): Promise<DogProfile[]> {
  const sql = await getSql();
  const rows = await sql<DogRow>`
    select id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio, portrait_id
    from dogs
    where user_id = ${userId}
    order by id asc
  `;
  return rows.map(mapDog);
}

/**
 * 犬が居なければ「うちの子」を1頭作る。初期は体重0、成犬去勢済み、おやつ10%。
 * 初回の /calorie。絵 id は DB 既定（空なら mapDog がチワワ／スムース）。
 * 初期ステージを変えるなら life_stage。上限10頭は addDog。
 */
async function ensureDogs(userId: string): Promise<DogProfile[]> {
  const existing = await listDogs(userId);
  if (existing.length > 0) return existing;
  const sql = await getSql();
  const created = await sql<DogRow>`
    insert into dogs (user_id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio)
    values (${userId}, ${"うちの子"}, 0, 0, ${"adult_neutered"}, 0.10)
    returning id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio, portrait_id
  `;
  const row = created[0];
  if (!row) throw new Error("愛犬プロフィールを作成できませんでした");
  return [mapDog(row)];
}

/**
 * dogId が一致すればそれ、無ければ先頭。一覧が空ならエラー。
 * 日付変更と画面を開くときの犬。localStorage の id が消えた犬なら先頭。
 * 記憶のキーは dog-switcher の STORAGE_KEY。ここは一覧からの選択だけ。
 */
function pickDog(dogs: DogProfile[], dogId?: number): DogProfile {
  const selected = dogId ? dogs.find((item) => item.id === dogId) : undefined;
  const dog = selected ?? dogs[0];
  if (!dog) throw new Error("愛犬が見つかりません");
  return dog;
}

/**
 * 指定 id がそのユーザーの犬でなければエラー。無ければ先に1頭作る。
 * 保存系の入口。他ユーザーの犬 id は拒否する。
 * 作成の初期値は ensureDogs。エラー文言を変えるならここの Error。
 */
async function requireDog(userId: string, dogId: number): Promise<DogProfile> {
  const dogs = await ensureDogs(userId);
  const dog = dogs.find((item) => item.id === dogId);
  if (!dog) throw new Error("愛犬が見つかりません");
  return dog;
}

/**
 * YYYY-MM-DD 以外は今日（日本時間）に落とす。画面から来る日付の入口。
 * 暮らし帳と /calorie が共有する date もこの形。壊れた値は todayJst。
 * 形式を変えるなら正規表現と todayJst。ロックは assertCalorieEditable。
 */
function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayJst();
  return value;
}

/**
 * 投与時刻などを ISO 文字列にする。空や不正は null。
 * dog_medicine_doses.given_at。画面の済／未は null かどうか。
 * 「—」にするのは機能追加日以前（medicineAddedOn）。ここは時刻の形だけ。
 */
function asIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * HH:MM だけ残す。時が24以上、分が60以上は null。
 * dog_medicines.due_time。空なら未投与の案内に出さない。
 * 形式を変えるなら正規表現と medicineInput の zod。
 */
function asClock(value: unknown): string | null {
  const match = String(value ?? "").match(/(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${match[1]}:${match[2]}`;
}

/**
 * dog_cares の1行。日付でなければ未実施（null）。残すのは last_done_on だけ。
 * おくすり画面の手入れ。毎日の済／未は持たない。未完了の案内も出さない。
 * 更新は markDogCare。取消は見ている日が最終日のときだけ空に戻す。
 */
function mapCare(row: { id: number; name: string; last_done_on: unknown }): DogCare {
  const day = asDateKey(row.last_done_on);
  return { id: row.id, name: row.name, lastDoneOn: day || null };
}

/**
 * 薬と、その日の投与。trackedFrom はここでは常に null。機能追加前の判定は medicineAddedOn。
 * due_time が空の薬は案内しない。追加日当日以前は画面が「—」。
 * 済は given_at。テーブルは dog_medicines と dog_medicine_doses。
 */
function mapMedicine(row: { id: number; name: string; note?: string; due_time?: unknown; given_at: unknown }): DogMedicine {
  return {
    id: row.id,
    name: row.name,
    note: row.note ?? "",
    dueTime: asClock(row.due_time),
    trackedFrom: null,
    givenAt: asIso(row.given_at),
  };
}

/**
 * app_settings.medicine_added_on。この日以前の投与は画面で「—」にする。
 * おくすり画面と暮らし帳の未投与案内。due_time があってもこの日以前は案内しない。
 * キー名を変えるなら SQL の key。比較の <= は beforeMedicineFeature。
 */
async function medicineAddedOn(sql: Awaited<ReturnType<typeof getSql>>): Promise<string | null> {
  const rows = await sql<{ value: string }>`
    select value from app_settings where key = 'medicine_added_on' limit 1
  `;
  const value = String(rows[0]?.value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * Date や文字列から YYYY-MM-DD だけ取る。取れなければ空。集計のキーもこの形。
 * 投与日と手入れの last_done_on、グラフの period_start。
 * 日本時間の今日は todayJst。ここは文字列の切り出しだけ。
 */
function asDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

/**
 * 体重の計測時刻です。その日の20:00（日本時間）として dog_weight_logs.measured_at に入れます。
 * 時刻だけ変えても、記録の日付キーは変わりません。グラフの赤点は期間内の最終日の体重。
 * 時刻を変えるならこの文字列。20時の文言は today-panel。
 */
function measuredAt20(date: string): string {
  return `${date}T20:00:00+09:00`;
}

/**
 * 画面を開く一式。犬・フード・定番・薬・手入れ・その日の記録と体重・人の絵を1本の SQL で取る。
 * 摂取 kcal は truncKcal（小数第1位で切り捨て）。グラフは空。点線と期末体重は getCalorieChart 側。
 * 犬が0頭なら「うちの子」を作って読み直す。
 */
async function loadState(userId: string, date: string, dogId?: number): Promise<CalorieState> {
  const sql = await getSql();
  const bundle = await sql<{
    dogs: unknown;
    foods: unknown;
    staples: unknown;
    medicines: unknown;
    cares: unknown;
    logs: unknown;
    today_weight: unknown;
    person_portrait: string | null;
  }>`
    with selected as (
      select id
      from dogs
      where user_id = ${userId}
      order by case when id = ${dogId ?? null} then 0 else 1 end, id
      limit 1
    )
    select
      coalesce((
        select json_agg(json_build_object(
          'id', d.id,
          'name', d.name,
          'current_weight_kg', d.current_weight_kg,
          'ideal_weight_kg', d.ideal_weight_kg,
          'life_stage', d.life_stage,
          'treat_ratio', d.treat_ratio,
          'portrait_id', d.portrait_id
        ) order by d.id)
        from dogs d
        where d.user_id = ${userId}
      ), '[]'::json) as dogs,
      coalesce((
        select json_agg(json_build_object(
          'id', f.id,
          'name', f.name,
          'kind', f.kind,
          'kcal', f.kcal,
          'amount', f.amount,
          'unit', f.unit
        ) order by f.kind, f.id)
        from dog_foods f
        where f.user_id = ${userId} and f.dog_id = (select id from selected)
      ), '[]'::json) as foods,
      coalesce((
        select json_agg(json_build_object(
          'id', s.id,
          'food_id', s.food_id,
          'qty', s.qty
        ) order by s.sort_order, s.id)
        from calorie_staples s
        where s.user_id = ${userId} and s.dog_id = (select id from selected)
      ), '[]'::json) as staples,
      coalesce((
        select json_agg(json_build_object(
          'id', m.id,
          'name', m.name,
          'note', m.note,
          'due_time', to_char(m.due_time, 'HH24:MI'),
          'given_at', d.given_at
        ) order by m.due_time nulls last, m.sort_order, m.id)
        from dog_medicines m
        left join dog_medicine_doses d
          on d.medicine_id = m.id and d.given_on = ${date}::date
        where m.user_id = ${userId} and m.dog_id = (select id from selected)
      ), '[]'::json) as medicines,
      coalesce((
        select json_agg(json_build_object(
          'id', c.id,
          'name', c.name,
          'last_done_on', to_char(c.last_done_on, 'YYYY-MM-DD')
        ) order by c.sort_order, c.id)
        from dog_cares c
        where c.user_id = ${userId} and c.dog_id = (select id from selected)
      ), '[]'::json) as cares,
      coalesce((
        select json_agg(json_build_object(
          'id', l.id,
          'log_date', l.log_date,
          'label', l.label,
          'kcal', l.kcal,
          'kind', l.kind,
          'food_id', l.food_id,
          'amount', l.amount,
          'unit', l.unit
        ) order by l.id)
        from calorie_logs l
        where l.user_id = ${userId}
          and l.dog_id = (select id from selected)
          and l.log_date = ${date}
      ), '[]'::json) as logs,
      (
        select w.weight_kg
        from dog_weight_logs w
        where w.user_id = ${userId}
          and w.dog_id = (select id from selected)
          and w.log_date = ${date}
        limit 1
      ) as today_weight,
      (
        select person_portrait
        from user_settings
        where user_id = ${userId}
        limit 1
      ) as person_portrait
  `;
  const row = bundle[0];
  const dogs = asRows<DogRow>(row?.dogs).map(mapDog);
  if (dogs.length === 0) {
    await sql`
      insert into dogs (user_id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio)
      values (${userId}, ${"うちの子"}, 0, 0, ${"adult_neutered"}, 0.10)
    `;
    return loadState(userId, date, dogId);
  }
  const dog = pickDog(dogs, dogId);
  const foods = asRows<FoodRow>(row?.foods);
  const staples = asRows<{ id: number; food_id: number; qty: unknown }>(row?.staples);
  const medicines = asRows<{ id: number; name: string; note: string; due_time: unknown; given_at: unknown }>(row?.medicines);
  const cares = asRows<{ id: number; name: string; last_done_on: unknown }>(row?.cares);
  const logs = asRows<LogRow>(row?.logs);
  const trends: Record<TrendGrain, DayTrend[]> = { day: [], week: [], month: [], year: [] };
  return {
    date,
    dog,
    dogs,
    foods: foods.map((item) => ({
      id: item.id,
      name: item.name,
      kind: asKind(item.kind),
      kcal: num(item.kcal),
      amount: num(item.amount),
      unit: item.unit,
    })),
    staples: staples.map((item) => ({
      id: item.id,
      foodId: item.food_id,
      qty: num(item.qty),
    })),
    medicines: medicines.map(mapMedicine),
    cares: cares.map(mapCare),
    medicineAddedOn: await medicineAddedOn(sql),
    logs: logs.map((item) => ({
      id: item.id,
      date: asDateKey(item.log_date) || String(item.log_date).slice(0, 10),
      label: item.label,
      kcal: truncKcal(num(item.kcal)),
      kind: asLogKind(item.kind),
      foodId: item.food_id,
      amount: item.amount == null ? null : num(item.amount),
      unit: item.unit,
    })),
    week: [],
    trend: [],
    trends,
    todayWeightKg: row?.today_weight == null ? null : num(row.today_weight, 2),
    personPortrait:
      row?.person_portrait && isPersonPortrait(row.person_portrait)
        ? row.person_portrait
        : DEFAULT_PERSON_PORTRAIT,
  };
}

/**
 * json_agg の結果を配列にする。文字列で来た JSON も読む。失敗は空配列。
 * 画面を開く SQL の犬・フード・定番・薬。壊れていても他の行は残す。
 * 形を変えるなら loadState の json_build_object。
 */
function asRows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 日付と犬の指定です。date は YYYY-MM-DD。メッセージを変えると、不正な日付のエラー文言が変わります。 */
const dateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive().optional(),
});

/** プロフィール保存の上限です。名前20文字、体重120kgまで、おやつ割合は 0〜0.3。超えると保存できません。 */
const saveDogInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  name: z.string().trim().min(1, "名前を入力してください").max(20),
  currentWeightKg: z.number().positive("現在の体重を入力してください").max(120),
  idealWeightKg: z.number().positive("理想体重を入力してください").max(120),
  lifeStage: z.string().refine(isLifeStageId, "ステージを選んでください"),
  treatRatio: z.number().min(0).max(0.3),
});

/** フード登録の上限です。名前30文字、kcal と分量は 10000 まで。単位は FOOD_UNITS と同じ並びに揃えてください。 */
const addFoodInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  name: z.string().trim().min(1, "名前を入力してください").max(30),
  kind: z.enum(["food", "treat"]),
  kcal: z.number().positive("カロリーを入力してください").max(10000),
  amount: z.number().positive("分量を入力してください").max(10000),
  unit: z.enum(["g", "個", "杯", "袋", "本"]),
});

/** 1食の記録の上限です。名前40文字、kcal は 20000 まで。kind に other を足すときは画面側も対応してください。 */
const addLogInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  label: z.string().trim().min(1).max(40),
  kcal: z.number().positive("カロリーを入力してください").max(20000),
  kind: z.enum(["food", "treat", "other"]),
  foodId: z.number().int().positive().nullable(),
  amount: z.number().positive().max(10000).nullable(),
  unit: z.string().max(8).nullable(),
});

/** 削除系の共通入力です。date・dogId・消す行の id。 */
const idDateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  id: z.number().int().positive(),
});

/**
 * 画面を開いたときの一式です。犬一覧、その犬のフード・定番・その日の記録・体重を返します。
 * 犬が1頭も無ければ「うちの子」（体重0、成犬去勢済み、おやつ10%）を作ってから読み直します。
 */
export const getCalorieState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(dateInput, input))
  .handler(async ({ context, data }) => loadState(context.userId, isoDate(data.date), data.dogId));

/**
 * 日付を変えたときに今日画面が使う、その日の記録と体重だけです。
 * 犬一覧やフードは取り直さず、記録・体重・おくすりを一度に取ります。kcal は truncKcal 済みです。
 */
export const getCalorieDay = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(dateInput, input))
  .handler(async ({ context, data }) => {
    const date = isoDate(data.date);
    const sql = await getSql();
    const dogId = data.dogId ?? pickDog(await ensureDogs(context.userId)).id;
    const [owned, logs, weights, medicines, addedOn] = await Promise.all([
      sql<{ id: number }>`
        select id from dogs
        where user_id = ${context.userId} and id = ${dogId}
        limit 1
      `,
      sql<LogRow>`
        select id, log_date, label, kcal, kind, food_id, amount, unit
        from calorie_logs
        where user_id = ${context.userId} and dog_id = ${dogId} and log_date = ${date}
        order by id asc
      `,
      sql<{ weight_kg: unknown }>`
        select weight_kg
        from dog_weight_logs
        where user_id = ${context.userId} and dog_id = ${dogId} and log_date = ${date}
        limit 1
      `,
      sql<{ id: number; name: string; note: string; due_time: unknown; given_at: unknown }>`
        select m.id, m.name, m.note, to_char(m.due_time, 'HH24:MI') as due_time, d.given_at
        from dog_medicines m
        left join dog_medicine_doses d
          on d.medicine_id = m.id and d.given_on = ${date}::date
        where m.user_id = ${context.userId} and m.dog_id = ${dogId}
        order by m.due_time nulls last, m.sort_order, m.id
      `,
      medicineAddedOn(sql),
    ]);
    if (!owned[0]) throw new Error("愛犬が見つかりません");
    const mapped: CalorieLog[] = logs.map((row) => ({
      id: row.id,
      date: asDateKey(row.log_date) || row.log_date,
      label: row.label,
      kcal: truncKcal(num(row.kcal)),
      kind: asLogKind(row.kind),
      foodId: row.food_id,
      amount: row.amount == null ? null : num(row.amount),
      unit: row.unit,
    }));
    return {
      date,
      logs: mapped,
      medicines: medicines.map(mapMedicine),
      medicineAddedOn: addedOn,
      todayWeightKg: weights[0] ? num(weights[0].weight_kg, 2) : null,
    };
  });

/**
 * グラフ用の散歩距離。walk_logs を日本時間の日付で合計し、メートルを小数1桁で持つ。
 * km への換算は summary.ts の attachWalks。カロリーの切り捨てとは別。
 */
async function loadWalkMeters(userId: string, from: string, to: string) {
  const sql = await getSql();
  const rows = await sql<{ log_date: string; distance_m: unknown }>`
    select to_char(coalesce(started_at, created_at) at time zone 'Asia/Tokyo', 'YYYY-MM-DD') as log_date,
           coalesce(sum(distance_m), 0) as distance_m
    from walk_logs
    where user_id = ${userId}
      and coalesce(started_at, created_at) >= (${from}::timestamp at time zone 'Asia/Tokyo')
      and coalesce(started_at, created_at) < ((${to}::date + interval '1 day')::timestamp at time zone 'Asia/Tokyo')
    group by 1
  `;
  const meters = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.log_date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) meters.set(key, num(row.distance_m, 1));
  }
  return meters;
}

/**
 * いま画面に出す日・週・月・年。確定した週・月・年の kcal は calorie_period_stats。
 * 進行中の期間は、集計日が今日より前なら今日の calorie_logs を足す（trendsForDisplay）。
 * 体重の点は期間内で終了日に一番近い計測（weightOnEnd。summary.ts）。日次はその日の体重。
 * 点線は calorie_period_guides。ガイドはプラン保存（saveDogProfile）で storePeriodGuides し直す。
 * 摂取は小数第1位で切り捨て（truncKcal）。全頭の作り直しは cron の rebuildAllCalorieStats（full）。
 */
async function loadVisibleChart(userId: string, dogId: number): Promise<Record<TrendGrain, DayTrend[]>> {
  const sql = await getSql();
  const seriesEnd = todayJst();
  const dayFrom = chartWindowStart("day", seriesEnd);
  const weekFrom = chartWindowStart("week", seriesEnd);
  const monthFrom = chartWindowStart("month", seriesEnd);
  const yearFrom = chartWindowStart("year", seriesEnd);
  const [maps, guideRows, statRows, todaySum, walks] = await Promise.all([
    loadDayMaps(sql, userId, dogId, dayFrom, seriesEnd),
    sql<{ period_type: string; period_start: unknown; guide_kcal: unknown }>`
      select period_type, period_start, guide_kcal
      from calorie_period_guides
      where dog_id = ${dogId}
        and (
          (period_type = 'day' and period_start >= ${dayFrom} and period_start <= ${seriesEnd})
          or (period_type = 'week' and period_start >= ${weekFrom} and period_start <= ${seriesEnd})
          or (period_type = 'month' and period_start >= ${monthFrom} and period_start <= ${seriesEnd})
          or (period_type = 'year' and period_start >= ${yearFrom} and period_start <= ${seriesEnd})
        )
    `,
    sql<{
      period_type: string;
      period_start: unknown;
      period_end: unknown;
      kcal_total: unknown;
      weight_kg: unknown;
      computed_at: unknown;
    }>`
      select period_type, period_start, period_end, kcal_total, weight_kg, computed_at
      from calorie_period_stats
      where dog_id = ${dogId}
        and (
          (period_type = 'week' and period_start >= ${weekFrom} and period_start <= ${seriesEnd})
          or (period_type = 'month' and period_start >= ${monthFrom} and period_start <= ${seriesEnd})
          or (period_type = 'year' and period_start >= ${yearFrom} and period_start <= ${seriesEnd})
        )
    `,
    sql<{ total: unknown }>`
      select coalesce(sum(kcal), 0) as total
      from calorie_logs
      where user_id = ${userId} and dog_id = ${dogId} and log_date = ${seriesEnd}
    `,
    loadWalkMeters(userId, yearFrom, seriesEnd),
  ]);
  const guideMap = new Map<string, number>();
  for (const row of guideRows) {
    const start = asDateKey(row.period_start);
    if (start) guideMap.set(`${row.period_type}:${start}`, truncKcal(num(row.guide_kcal)));
  }
  return attachWalks(
    attachGuides(
      trendsForDisplay(maps.kcal, maps.kg, statRows, seriesEnd, dayFrom, {
        todayKcal: truncKcal(num(todaySum[0]?.total)),
        mapsFrom: dayFrom,
      }),
      guideMap,
    ),
    walks,
  );
}

/** グラフ取得は犬 id だけ。終端の日付は常に今日（日本時間）。 */
const chartInput = z.object({
  dogId: z.number().int().positive(),
});

/**
 * いま画面に出ている範囲のグラフ（日・週・月・年）です。散歩距離は walk_logs から足します。
 * 日次は直近7日。赤は期末体重、茶色は散歩、線は kcal、点線は目安。
 * 切り捨て・期末体重・点線は loadVisibleChart。ガイドはプラン保存で書き、cron では作らない。
 */
export const getCalorieChart = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(chartInput, input))
  .handler(async ({ context, data }) => {
    await requireDog(context.userId, data.dogId);
    const trends = await loadVisibleChart(context.userId, data.dogId);
    return { trend: trends.day, trends };
  });

/** 過去へ送るときの入力。grain は日週月年、end は窓の終端（YYYY-MM-DD）。未来は handler が今日まで切る。 */
const trendInput = z.object({
  dogId: z.number().int().positive(),
  grain: z.enum(["day", "week", "month", "year"]),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * グラフを過去へ送ったとき、その粒度の1窓分を足します。未来の日付は今日までに切ります。
 * 週・月・年の確定分は calorie_period_stats（kcal は小数第1位で切り捨て、体重は保存済みの期末）。
 * 進行中の期間は今日の calorie_logs を足します。点線は calorie_period_guides（プラン保存時に作成）。
 */
export const getCalorieTrend = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(trendInput, input))
  .handler(async ({ context, data }): Promise<DayTrend[]> => {
    const today = todayJst();
    const end = data.end > today ? today : data.end;
    const start = chartWindowStart(data.grain, end);
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const guides = await sql<{ period_start: unknown; guide_kcal: unknown }>`
      select period_start, guide_kcal
      from calorie_period_guides
      where dog_id = ${dog.id}
        and period_type = ${data.grain}
        and period_start >= ${start}
        and period_start <= ${end}
    `;
    const guideMap = new Map<string, number>();
    for (const row of guides) {
      const key = asDateKey(row.period_start);
      if (key) guideMap.set(`${data.grain}:${key}`, truncKcal(num(row.guide_kcal)));
    }
    if (data.grain === "day") {
      const [maps, walks] = await Promise.all([
        loadDayMaps(sql, context.userId, dog.id, start, end),
        loadWalkMeters(context.userId, start, end),
      ]);
      const series = buildDaySeries(maps.kcal, maps.kg, end, start);
      return attachWalks(attachGuides({ day: series, week: [], month: [], year: [] }, guideMap), walks).day;
    }
    const stats = await sql<{
      period_type: string;
      period_start: unknown;
      period_end: unknown;
      kcal_total: unknown;
      weight_kg: unknown;
      computed_at: unknown;
    }>`
      select period_type, period_start, period_end, kcal_total, weight_kg, computed_at
      from calorie_period_stats
      where dog_id = ${dog.id}
        and period_type = ${data.grain}
        and period_start >= ${start}
        and period_start <= ${end}
    `;
    const includeToday = end >= today;
    const todayKcal = includeToday
      ? truncKcal(
          num(
            (
              await sql<{ total: unknown }>`
                select coalesce(sum(kcal), 0) as total
                from calorie_logs
                where user_id = ${context.userId} and dog_id = ${dog.id} and log_date = ${today}
              `
            )[0]?.total,
          ),
        )
      : 0;
    const maps =
      data.grain === "week" && includeToday
        ? await loadDayMaps(sql, context.userId, dog.id, start, today)
        : { kcal: new Map<string, number>(), kg: new Map<string, number>() };
    const trends = trendsForDisplay(maps.kcal, maps.kg, stats, today, start, {
      todayKcal,
      mapsFrom: data.grain === "week" && includeToday ? start : "9999-12-31",
    });
    const grain = data.grain as Exclude<TrendGrain, "day">;
    const walks = await loadWalkMeters(context.userId, start, end);
    return attachWalks(attachGuides(trends, guideMap), walks)[grain].filter(
      (point) => point.start >= start && point.start <= end,
    );
  });

/**
 * 名前・体重・ステージ・おやつ割合を dogs に保存します。
 * 続けて dailyEnergy（理想体重 × 係数）で calorie_period_guides の点線を作り直します。
 * 目安は「1日の目標 × 期間の日数」で、小数第1位まで切り捨てて保存します。過去の摂取合計はここでは変えません。
 */
export const saveDogProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(saveDogInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      update dogs
      set
        name = ${data.name},
        current_weight_kg = ${data.currentWeightKg},
        ideal_weight_kg = ${data.idealWeightKg},
        life_stage = ${data.lifeStage},
        treat_ratio = ${data.treatRatio},
        updated_at = now()
      where id = ${dog.id} and user_id = ${context.userId}
    `;
    await storePeriodGuides(
      sql,
      context.userId,
      dog.id,
      dailyEnergy(data.idealWeightKg, data.lifeStage),
    );
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 犬の絵テンプレートだけを保存します。カロリーの目安は変えません。
 * dogs.portrait_id。id は portraits.ts の DOG_PORTRAITS。不明な id は zod が拒否する。
 * 段階つきの絵は chihuahua-smooth-wr だけ。点線は saveDogProfile。
 */
export const saveDogPortrait = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
        dogId: z.number().int().positive(),
        portraitId: z.string().refine(isDogPortrait, "犬の絵を選んでください"),
      }),
      input,
    ),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      update dogs
      set portrait_id = ${data.portraitId}, updated_at = now()
      where id = ${dog.id} and user_id = ${context.userId}
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 人の絵テンプレートを保存します。机の表示設定は変えません。
 * user_settings.person_portrait。id は PERSON_PORTRAITS。世帯で1つ。
 * 未設定の表示は personMenuSrc。犬の絵は saveDogPortrait。
 */
export const savePersonPortrait = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
        dogId: z.number().int().positive().optional(),
        portraitId: z.string().refine(isPersonPortrait, "人の絵を選んでください"),
      }),
      input,
    ),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into user_settings (user_id, person_portrait, updated_at)
      values (${context.userId}, ${data.portraitId}, now())
      on conflict (user_id) do update set
        person_portrait = excluded.person_portrait,
        updated_at = now()
    `;
    return loadState(context.userId, data.date, data.dogId);
  });

/**
 * 犬を1頭足します。10頭まで。初期値は体重0、adult_neutered、おやつ10%です。
 * 11頭目はこのエラーになります。初期ステージを変えるならここの life_stage です。
 */
export const addDog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
        name: z.string().trim().min(1, "名前を入力してください").max(20),
      }),
      input,
    ),
  )
  .handler(async ({ context, data }) => {
    const dogs = await ensureDogs(context.userId);
    if (dogs.length >= 10) throw new Error("登録できるのは10頭までです");
    const sql = await getSql();
    const created = await sql<DogRow>`
      insert into dogs (user_id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio)
      values (${context.userId}, ${data.name}, 0, 0, ${"adult_neutered"}, 0.10)
      returning id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio, portrait_id
    `;
    const row = created[0];
    if (!row) throw new Error("愛犬プロフィールを作成できませんでした");
    return loadState(context.userId, data.date, row.id);
  });

/**
 * 犬を消します。最後の1頭は消せません。dogs を消すと、紐づく記録はDBの外部キーに従います。
 * プロフィールの「この子を削除」。次に開く犬は残った先頭側。
 * 拒否の文言を変えるならここの Error。上限の追加は addDog。
 */
export const deleteDog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
        dogId: z.number().int().positive(),
      }),
      input,
    ),
  )
  .handler(async ({ context, data }) => {
    const dogs = await ensureDogs(context.userId);
    if (dogs.length <= 1) throw new Error("最後の1頭は削除できません");
    const dog = dogs.find((item) => item.id === data.dogId);
    if (!dog) throw new Error("愛犬が見つかりません");
    const sql = await getSql();
    await sql`delete from dogs where id = ${dog.id} and user_id = ${context.userId}`;
    const next = dogs.find((item) => item.id !== dog.id);
    return loadState(context.userId, data.date, next?.id);
  });

/**
 * フードを dog_foods に1件追加します。kind は food（ごはん）か treat（おやつ）です。
 * フードタブ。今日のチップは kcal と amount から割る（kcalForQuantity）。
 * 単位は FOOD_UNITS。上限は addFoodInput。
 */
export const addDogFood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(addFoodInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      insert into dog_foods (user_id, dog_id, name, kind, kcal, amount, unit)
      values (
        ${context.userId},
        ${dog.id},
        ${data.name},
        ${data.kind},
        ${data.kcal},
        ${data.amount},
        ${data.unit}
      )
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * そのフードを dog_foods から消します。定番が残るかはDBの外部キー次第です。
 * フードタブのゴミ箱。食べた calorie_logs は消さない。
 * 定番も消すなら calorie_staples 側。画面は FoodsPanel。
 */
export const deleteDogFood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      delete from dog_foods
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/** 定番の数量です。1頭あたり最大50件（ids の上限）。数量は 10000 まで。 */
const stapleInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  id: z.number().int().positive().optional(),
  foodId: z.number().int().positive(),
  qty: z.number().positive("数量を入力してください").max(10000),
});

/**
 * 定番を新規または更新します。新規の sort_order は、その犬の最大値+1（無ければ1）です。
 * 更新は food_id と qty だけで、並び順は変えません。並びは reorderCalorieStaples です。
 */
export const saveCalorieStaple = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(stapleInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const food = await sql<{ id: number }>`
      select id from dog_foods
      where id = ${data.foodId} and user_id = ${context.userId} and dog_id = ${dog.id}
      limit 1
    `;
    if (!food[0]) throw new Error("フードが見つかりません");
    if (data.id) {
      const updated = await sql<{ id: number }>`
        update calorie_staples
        set food_id = ${data.foodId}, qty = ${data.qty}
        where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
        returning id
      `;
      if (!updated[0]) throw new Error("定番が見つかりません");
    } else {
      await sql`
        insert into calorie_staples (user_id, dog_id, food_id, qty, sort_order)
        values (
          ${context.userId},
          ${dog.id},
          ${data.foodId},
          ${data.qty},
          coalesce((
            select max(sort_order) + 1 from calorie_staples
            where dog_id = ${dog.id}
          ), 1)
        )
      `;
    }
    return loadState(context.userId, data.date, dog.id);
  });

/** 定番を並べ替える入力です。ids はその犬の定番を過不足なく、新しい順で並べたものです。 */
const stapleOrderInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  ids: z.array(z.number().int().positive()).min(1).max(50),
});

/**
 * 渡された ids の順に sort_order を 1, 2, 3… と書き直します。
 * 件数や id が保存済みと違うと保存しません。今日画面のドラッグ並び替えがここを呼びます。
 */
export const reorderCalorieStaples = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(stapleOrderInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const rows = await sql<{ id: number }>`
      select id from calorie_staples
      where user_id = ${context.userId} and dog_id = ${dog.id}
    `;
    const owned = new Set(rows.map((row) => row.id));
    if (data.ids.length !== owned.size || data.ids.some((id) => !owned.has(id))) {
      throw new Error("並び順を保存できません");
    }
    for (let index = 0; index < data.ids.length; index += 1) {
      const id = data.ids[index];
      if (id == null) continue;
      await sql`
        update calorie_staples
        set sort_order = ${index + 1}
        where id = ${id} and user_id = ${context.userId} and dog_id = ${dog.id}
      `;
    }
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 定番を1件消します。残った行の sort_order は詰めません（歯抜けでも表示順は小さい順のままです）。
 * 今日タブの定番管理。テーブルは calorie_staples。
 * 並びを詰め直すなら reorderCalorieStaples。新規の順番は最大値+1。
 */
export const deleteCalorieStaple = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      delete from calorie_staples
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/** 薬の名前は30文字、予定時刻は HH:MM、メモは40文字まで。時刻の形式を変えるときは画面の入力も揃える。 */
const medicineInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "薬の名前を入力してください").max(30),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時間を入力してください"),
  note: z.string().trim().max(40).optional(),
});

/**
 * 薬の名前と毎日の予定時刻を登録・更新する。note は用量などのメモ。
 * dog_medicines。due_time が空の薬は未投与案内に出ない。追加日以前の表示は「—」。
 * 文字数は medicineInput。投与そのものは giveDogMedicine。
 */
export const saveDogMedicine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(medicineInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const note = data.note?.trim() ?? "";
    if (data.id) {
      const updated = await sql<{ id: number }>`
        update dog_medicines
        set name = ${data.name}, note = ${note}, due_time = ${data.dueTime}::time
        where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
        returning id
      `;
      if (!updated[0]) throw new Error("薬が見つかりません");
    } else {
      await sql`
        insert into dog_medicines (user_id, dog_id, name, note, due_time, tracked_from, sort_order)
        values (
          ${context.userId},
          ${dog.id},
          ${data.name},
          ${note},
          ${data.dueTime}::time,
          ${todayJst()}::date,
          coalesce((
            select max(sort_order) + 1 from dog_medicines where dog_id = ${dog.id}
          ), 1)
        )
      `;
    }
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * その日の投与を記録する。同じ薬・同じ日は1回だけ。
 * dog_medicine_doses。機能追加日以前は画面が「投与した」を出さない。
 * 取消は undoDogMedicine。遅れの条件は overdueMedicines。
 */
export const giveDogMedicine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const medicine = await sql<{ id: number }>`
      select id from dog_medicines
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
      limit 1
    `;
    if (!medicine[0]) throw new Error("薬が見つかりません");
    await sql`
      insert into dog_medicine_doses (user_id, dog_id, medicine_id, given_on, given_at)
      values (${context.userId}, ${dog.id}, ${data.id}, ${data.date}::date, now())
      on conflict (medicine_id, given_on) do nothing
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 押し間違い用。その日の投与記録だけ消す。
 * dog_medicine_doses のその日の行。薬の登録は残る。
 * 薬そのものを消すなら deleteDogMedicine。追加日以前は画面に取消が無い。
 */
export const undoDogMedicine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      delete from dog_medicine_doses
      where medicine_id = ${data.id}
        and user_id = ${context.userId}
        and dog_id = ${dog.id}
        and given_on = ${data.date}::date
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 薬の登録そのものを消す。その日の取り消しだけなら undoDogMedicine。
 * dog_medicines。履歴の残り方は外部キー次第。
 * おくすり画面の管理シート。予定時刻の案内も一緒に消える。
 */
export const deleteDogMedicine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      delete from dog_medicines
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/** 手入れの名前は30文字まで。最後にやった日はこの入力では変えない。 */
const careInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "名前を入力してください").max(30),
});

/**
 * 毎日ではない手入れの名前を登録・更新する。最後にやった日は変えない。
 * dog_cares は last_done_on だけを残す。毎日の済／未は作らない。
 * 名前の上限は careInput。日付を入れるのは markDogCare。
 */
export const saveDogCare = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(careInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    if (data.id) {
      const updated = await sql<{ id: number }>`
        update dog_cares
        set name = ${data.name}
        where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
        returning id
      `;
      if (!updated[0]) throw new Error("手入れが見つかりません");
    } else {
      await sql`
        insert into dog_cares (user_id, dog_id, name, sort_order)
        values (
          ${context.userId},
          ${dog.id},
          ${data.name},
          coalesce((select max(sort_order) + 1 from dog_cares where dog_id = ${dog.id}), 1)
        )
      `;
    }
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 見ている日を最後にやった日にする。それより新しい記録があるときは動かさない。未来日は不可。
 * dog_cares.last_done_on だけ更新する。それ以前の日は残さない。
 * 未完了の案内は出さない。取消は undoDogCare。
 */
export const markDogCare = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    if (data.date > todayJst()) throw new Error("未来の日付は入れられません");
    const updated = await sql<{ id: number }>`
      update dog_cares
      set last_done_on = ${data.date}::date
      where id = ${data.id}
        and user_id = ${context.userId}
        and dog_id = ${dog.id}
        and (last_done_on is null or last_done_on <= ${data.date}::date)
      returning id
    `;
    if (!updated[0]) {
      const exists = await sql<{ id: number }>`
        select id from dog_cares
        where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
        limit 1
      `;
      if (!exists[0]) throw new Error("手入れが見つかりません");
    }
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 見ている日が最後の記録なら消す。それ以前の日は残さない。
 * last_done_on を null に戻すだけ。履歴テーブルは無い。
 * 別の日が最終日なら何もしない。行の削除は deleteDogCare。
 */
export const undoDogCare = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      update dog_cares
      set last_done_on = null
      where id = ${data.id}
        and user_id = ${context.userId}
        and dog_id = ${dog.id}
        and last_done_on = ${data.date}::date
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 手入れの登録を消す。最後にやった日だけ消すなら undoDogCare。
 * dog_cares の行ごと。おくすり画面の管理シート。
 * 毎日の済／未は最初から無い。案内も出さない。
 */
export const deleteDogCare = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    await sql`
      delete from dog_cares
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
    `;
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 摂取を1件足します。14日ロック（assertCalorieEditable）より前は保存しません。
 * kcal は truncKcal（小数第1位で切り捨て）して calorie_logs へ。そのあと refreshDogStats で週・月・年の「いまの期間」だけ更新します。
 * 約5年分の全作り直し（full）は cron の rebuildAllCalorieStats だけです。
 */
export const addCalorieLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(addLogInput, input))
  .handler(async ({ context, data }) => {
    assertCalorieEditable(data.date);
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const kcal = truncKcal(data.kcal);
    await sql`
      insert into calorie_logs (user_id, dog_id, log_date, label, kcal, kind, food_id, amount, unit)
      values (
        ${context.userId},
        ${dog.id},
        ${data.date},
        ${data.label},
        ${kcal},
        ${data.kind},
        ${data.foodId},
        ${data.amount},
        ${data.unit}
      )
    `;
    await refreshDogStats(sql, context.userId, dog.id, data.date);
    return loadState(context.userId, data.date, dog.id);
  });

/**
 * 摂取を1件消します。ロック判定はその行の log_date です（画面の表示日ではありません）。
 * 消したあと同じく refreshDogStats（full ではない）で、その時点の週・月・年だけ更新します。
 * 期末体重は体重の保存側。ここは摂取合計だけが変わります。
 */
export const deleteCalorieLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const existing = await sql<{ log_date: string }>`
      select log_date from calorie_logs
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
      limit 1
    `;
    const logDate = asDateKey(existing[0]?.log_date) || data.date;
    assertCalorieEditable(logDate);
    await sql`
      delete from calorie_logs
      where id = ${data.id} and user_id = ${context.userId} and dog_id = ${dog.id}
    `;
    await refreshDogStats(sql, context.userId, dog.id, data.date);
    return loadState(context.userId, data.date, dog.id);
  });

/** 体重保存の上限です。0より大きく120kgまで。日付の形式が違うと「日付が正しくありません」。 */
const saveWeightInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  weightKg: z.number().positive("体重を入力してください").max(120),
});

/**
 * その日の体重を1件保存します（同じ日なら上書き）。計測時刻は20:00（日本時間）です。
 * それより新しい体重が無いときだけ、dogs.current_weight_kg もこの値に更新します。
 * 14日より前は変更できません。保存後に集計（期末体重は期間内の最終計測）を更新します。full 再計算はしません。
 */
export const saveWeightLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(saveWeightInput, input))
  .handler(async ({ context, data }) => {
    assertCalorieEditable(data.date);
    const sql = await getSql();
    const dog = await requireDog(context.userId, data.dogId);
    const measuredAt = measuredAt20(data.date);
    const weightKg = num(data.weightKg, 2);
    await sql`
      insert into dog_weight_logs (user_id, dog_id, log_date, weight_kg, measured_at, updated_at)
      values (
        ${context.userId},
        ${dog.id},
        ${data.date},
        ${weightKg},
        ${measuredAt}::timestamptz,
        now()
      )
      on conflict (dog_id, log_date) do update set
        weight_kg = excluded.weight_kg,
        measured_at = excluded.measured_at,
        updated_at = now()
    `;
    await sql`
      update dogs
      set current_weight_kg = ${weightKg}, updated_at = now()
      where id = ${dog.id} and user_id = ${context.userId}
        and not exists (
          select 1 from dog_weight_logs
          where dog_id = ${dog.id} and log_date > ${data.date}
        )
    `;
    await refreshDogStats(sql, context.userId, dog.id, data.date);
    return loadState(context.userId, data.date, dog.id);
  });

type HouseholdRow = {
  id: number;
  name: string;
  weight_kg: unknown;
  staples: unknown;
};

/**
 * 全頭分の行を画面用にする。定番の kcal はフード定義の値で、食べた記録の切り捨て前。
 * まとめて画面。体重は小数2桁。その日の1件で、平均ではない。
 * 足すときの kcal は画面が truncKcal する。
 */
function mapHouseholdDogs(rows: HouseholdRow[]): HouseholdDogDay[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weightKg: row.weight_kg == null ? null : num(row.weight_kg, 2),
    staples: asRows<{
      id: number;
      food_id: number;
      name: string;
      qty: unknown;
      unit: string;
      kcal: unknown;
      amount: unknown;
      kind: string;
    }>(row.staples).map((item) => ({
      id: item.id,
      foodId: item.food_id,
      name: item.name,
      qty: num(item.qty),
      unit: item.unit,
      kcal: num(item.kcal),
      amount: num(item.amount),
      kind: asKind(item.kind),
    })),
  }));
}

/**
 * その日の全頭の体重と定番。まとめて入力が使う。グラフは取らない。
 * dog_weight_logs のその日と calorie_staples。日付は暮らし帳の held か URL。
 * 2週間より前の変更は画面と assertCalorieEditable。
 */
async function loadHouseholdDay(userId: string, date: string): Promise<HouseholdDogDay[]> {
  const sql = await getSql();
  const rows = await sql<HouseholdRow>`
    select
      d.id,
      d.name,
      (
        select w.weight_kg
        from dog_weight_logs w
        where w.user_id = ${userId} and w.dog_id = d.id and w.log_date = ${date}
        limit 1
      ) as weight_kg,
      coalesce((
        select json_agg(json_build_object(
          'id', s.id,
          'food_id', f.id,
          'name', f.name,
          'qty', s.qty,
          'unit', f.unit,
          'kcal', f.kcal,
          'amount', f.amount,
          'kind', f.kind
        ) order by s.sort_order, s.id)
        from calorie_staples s
        join dog_foods f on f.id = s.food_id and f.user_id = s.user_id
        where s.user_id = ${userId} and s.dog_id = d.id
      ), '[]'::json) as staples
    from dogs d
    where d.user_id = ${userId}
    order by d.id
  `;
  return mapHouseholdDogs(rows);
}

/**
 * まとめて入力の初期表示。ログイン必須。グラフは取らない。
 * 日付はその日の体重と定番だけ。期末体重の系列は作らない。
 * 中身は loadHouseholdDay。ロック日数は CALORIE_EDIT_DAYS。
 */
export const getHouseholdDay = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ date: dateInput.shape.date }), input))
  .handler(async ({ context, data }) => loadHouseholdDay(context.userId, isoDate(data.date)));

const saveHouseholdWeightsInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  weights: z
    .array(
      z.object({
        dogId: z.number().int().positive(),
        weightKg: z.number().positive("体重を入力してください").max(120),
      }),
    )
    .min(1, "保存する体重がありません")
    .max(10),
});

/**
 * 複数の犬の体重を、その日の20時として一度に保存する。空欄の犬は送らない。
 * 頭ごとに期末体重の集計を更新する（full ではない）。点線のガイドは触らない。
 * 2週間ロックは assertCalorieEditable。上限 120kg はスキーマ。
 */
export const saveHouseholdWeights = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(saveHouseholdWeightsInput, input))
  .handler(async ({ context, data }) => {
    assertCalorieEditable(data.date);
    const sql = await getSql();
    const measuredAt = measuredAt20(data.date);
    for (const item of data.weights) {
      const dog = await requireDog(context.userId, item.dogId);
      const weightKg = num(item.weightKg, 2);
      await sql`
        insert into dog_weight_logs (user_id, dog_id, log_date, weight_kg, measured_at, updated_at)
        values (
          ${context.userId},
          ${dog.id},
          ${data.date},
          ${weightKg},
          ${measuredAt}::timestamptz,
          now()
        )
        on conflict (dog_id, log_date) do update set
          weight_kg = excluded.weight_kg,
          measured_at = excluded.measured_at,
          updated_at = now()
      `;
      await sql`
        update dogs
        set current_weight_kg = ${weightKg}, updated_at = now()
        where id = ${dog.id} and user_id = ${context.userId}
          and not exists (
            select 1 from dog_weight_logs
            where dog_id = ${dog.id} and log_date > ${data.date}
          )
      `;
      await refreshDogStats(sql, context.userId, dog.id, data.date);
    }
    return loadHouseholdDay(context.userId, data.date);
  });
