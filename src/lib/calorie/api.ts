import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assertCalorieEditable, dailyEnergy, isLifeStageId, todayJst, truncKcal } from "./formula";
import { attachGuides, attachWalks, buildDaySeries, chartWindowStart, loadDayMaps, refreshDogStats, storePeriodGuides, trendsForDisplay } from "./summary";
import type { CalorieLog, CalorieState, DayTrend, DogProfile, FoodKind, LogKind, TrendGrain } from "./types";

function num(value: unknown, places = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** places;
  return Math.round(parsed * factor) / factor;
}

function asKind(value: string): FoodKind {
  return value === "treat" ? "treat" : "food";
}

function asLogKind(value: string): LogKind {
  if (value === "food" || value === "treat") return value;
  return "other";
}

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

function mapDog(row: DogRow): DogProfile {
  return {
    id: row.id,
    name: row.name,
    currentWeightKg: num(row.current_weight_kg, 2),
    idealWeightKg: num(row.ideal_weight_kg, 2),
    lifeStage: isLifeStageId(row.life_stage) ? row.life_stage : "adult_neutered",
    treatRatio: num(row.treat_ratio, 2) || 0.1,
  };
}

async function listDogs(userId: string): Promise<DogProfile[]> {
  const sql = await getSql();
  const rows = await sql<DogRow>`
    select id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio
    from dogs
    where user_id = ${userId}
    order by id asc
  `;
  return rows.map(mapDog);
}

async function ensureDogs(userId: string): Promise<DogProfile[]> {
  const existing = await listDogs(userId);
  if (existing.length > 0) return existing;
  const sql = await getSql();
  const created = await sql<DogRow>`
    insert into dogs (user_id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio)
    values (${userId}, ${"うちの子"}, 0, 0, ${"adult_neutered"}, 0.10)
    returning id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio
  `;
  const row = created[0];
  if (!row) throw new Error("愛犬プロフィールを作成できませんでした");
  return [mapDog(row)];
}

function pickDog(dogs: DogProfile[], dogId?: number): DogProfile {
  const selected = dogId ? dogs.find((item) => item.id === dogId) : undefined;
  const dog = selected ?? dogs[0];
  if (!dog) throw new Error("愛犬が見つかりません");
  return dog;
}

async function requireDog(userId: string, dogId: number): Promise<DogProfile> {
  const dogs = await ensureDogs(userId);
  const dog = dogs.find((item) => item.id === dogId);
  if (!dog) throw new Error("愛犬が見つかりません");
  return dog;
}

function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayJst();
  return value;
}

function asDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function measuredAt20(date: string): string {
  return `${date}T20:00:00+09:00`;
}

async function loadState(userId: string, date: string, dogId?: number): Promise<CalorieState> {
  const sql = await getSql();
  const bundle = await sql<{
    dogs: unknown;
    foods: unknown;
    staples: unknown;
    logs: unknown;
    today_weight: unknown;
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
          'treat_ratio', d.treat_ratio
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
      ) as today_weight
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
  };
}

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

const dateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive().optional(),
});

const saveDogInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  name: z.string().trim().min(1, "名前を入力してください").max(20),
  currentWeightKg: z.number().positive("現在の体重を入力してください").max(120),
  idealWeightKg: z.number().positive("理想体重を入力してください").max(120),
  lifeStage: z.string().refine(isLifeStageId, "ステージを選んでください"),
  treatRatio: z.number().min(0).max(0.3),
});

const addFoodInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  name: z.string().trim().min(1, "名前を入力してください").max(30),
  kind: z.enum(["food", "treat"]),
  kcal: z.number().positive("カロリーを入力してください").max(10000),
  amount: z.number().positive("分量を入力してください").max(10000),
  unit: z.enum(["g", "個", "杯", "袋", "本"]),
});

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

const idDateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  id: z.number().int().positive(),
});

export const getCalorieState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(dateInput, input))
  .handler(async ({ context, data }) => loadState(context.userId, isoDate(data.date), data.dogId));

export const getCalorieDay = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(dateInput, input))
  .handler(async ({ context, data }) => {
    const date = isoDate(data.date);
    const sql = await getSql();
    const dog = data.dogId ? await requireDog(context.userId, data.dogId) : pickDog(await ensureDogs(context.userId));
    const [logs, weights] = await Promise.all([
      sql<LogRow>`
        select id, log_date, label, kcal, kind, food_id, amount, unit
        from calorie_logs
        where user_id = ${context.userId} and dog_id = ${dog.id} and log_date = ${date}
        order by id asc
      `,
      sql<{ weight_kg: unknown }>`
        select weight_kg
        from dog_weight_logs
        where user_id = ${context.userId} and dog_id = ${dog.id} and log_date = ${date}
        limit 1
      `,
    ]);
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
      todayWeightKg: weights[0] ? num(weights[0].weight_kg, 2) : null,
    };
  });

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

const chartInput = z.object({
  dogId: z.number().int().positive(),
});

export const getCalorieChart = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(chartInput, input))
  .handler(async ({ context, data }) => {
    await requireDog(context.userId, data.dogId);
    const trends = await loadVisibleChart(context.userId, data.dogId);
    return { trend: trends.day, trends };
  });

const trendInput = z.object({
  dogId: z.number().int().positive(),
  grain: z.enum(["day", "week", "month", "year"]),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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
      returning id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio
    `;
    const row = created[0];
    if (!row) throw new Error("愛犬プロフィールを作成できませんでした");
    return loadState(context.userId, data.date, row.id);
  });

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

const stapleInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  id: z.number().int().positive().optional(),
  foodId: z.number().int().positive(),
  qty: z.number().positive("数量を入力してください").max(10000),
});

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

const saveWeightInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  dogId: z.number().int().positive(),
  weightKg: z.number().positive("体重を入力してください").max(120),
});

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
