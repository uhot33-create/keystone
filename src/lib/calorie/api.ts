import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isLifeStageId, shiftIsoDate, todayJst } from "./formula";
import type { CalorieState, DogProfile, DayTotal, FoodKind, LogKind } from "./types";

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

type SumRow = {
  log_date: string;
  total: unknown;
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

async function ensureDog(userId: string): Promise<DogProfile> {
  const sql = await getSql();
  const existing = await sql<DogRow>`
    select id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio
    from dogs
    where user_id = ${userId}
    limit 1
  `;
  if (existing[0]) return mapDog(existing[0]);

  const created = await sql<DogRow>`
    insert into dogs (user_id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio)
    values (${userId}, ${"うちの子"}, 0, 0, ${"adult_neutered"}, 0.10)
    returning id, name, current_weight_kg, ideal_weight_kg, life_stage, treat_ratio
  `;
  const row = created[0];
  if (!row) throw new Error("愛犬プロフィールを作成できませんでした");
  return mapDog(row);
}

function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayJst();
  return value;
}

async function loadState(userId: string, date: string): Promise<CalorieState> {
  const sql = await getSql();
  const dog = await ensureDog(userId);
  const start = shiftIsoDate(date, -6);

  const [foods, logs, sums] = await Promise.all([
    sql<FoodRow>`
      select id, name, kind, kcal, amount, unit
      from dog_foods
      where user_id = ${userId} and dog_id = ${dog.id}
      order by kind asc, id asc
    `,
    sql<LogRow>`
      select id, log_date, label, kcal, kind, food_id, amount, unit
      from calorie_logs
      where user_id = ${userId} and dog_id = ${dog.id} and log_date = ${date}
      order by id asc
    `,
    sql<SumRow>`
      select log_date, coalesce(sum(kcal), 0) as total
      from calorie_logs
      where user_id = ${userId} and dog_id = ${dog.id}
        and log_date >= ${start} and log_date <= ${date}
      group by log_date
    `,
  ]);

  const sumByDate = new Map(sums.map((row) => [row.log_date, num(row.total)]));
  const week: DayTotal[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const day = shiftIsoDate(date, offset);
    week.push({ date: day, total: sumByDate.get(day) ?? 0 });
  }

  return {
    date,
    dog,
    foods: foods.map((row) => ({
      id: row.id,
      name: row.name,
      kind: asKind(row.kind),
      kcal: num(row.kcal),
      amount: num(row.amount),
      unit: row.unit,
    })),
    logs: logs.map((row) => ({
      id: row.id,
      date: row.log_date,
      label: row.label,
      kcal: num(row.kcal),
      kind: asLogKind(row.kind),
      foodId: row.food_id,
      amount: row.amount == null ? null : num(row.amount),
      unit: row.unit,
    })),
    week,
  };
}

const dateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
});

const saveDogInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  name: z.string().trim().min(1, "名前を入力してください").max(20),
  currentWeightKg: z.number().positive("現在の体重を入力してください").max(120),
  idealWeightKg: z.number().positive("理想体重を入力してください").max(120),
  lifeStage: z.string().refine(isLifeStageId, "ステージを選んでください"),
  treatRatio: z.number().min(0).max(0.3),
});

const addFoodInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  name: z.string().trim().min(1, "名前を入力してください").max(30),
  kind: z.enum(["food", "treat"]),
  kcal: z.number().positive("カロリーを入力してください").max(10000),
  amount: z.number().positive("分量を入力してください").max(10000),
  unit: z.enum(["g", "個", "杯", "袋", "本"]),
});

const addLogInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  label: z.string().trim().min(1).max(40),
  kcal: z.number().positive("カロリーを入力してください").max(20000),
  kind: z.enum(["food", "treat", "other"]),
  foodId: z.number().int().positive().nullable(),
  amount: z.number().positive().max(10000).nullable(),
  unit: z.string().max(8).nullable(),
});

const idDateInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません"),
  id: z.number().int().positive(),
});

export const getCalorieState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(dateInput, input))
  .handler(async ({ context, data }) => loadState(context.userId, isoDate(data.date)));

export const saveDogProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(saveDogInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await ensureDog(context.userId);
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
    return loadState(context.userId, data.date);
  });

export const addDogFood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(addFoodInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await ensureDog(context.userId);
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
    return loadState(context.userId, data.date);
  });

export const deleteDogFood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from dog_foods
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return loadState(context.userId, data.date);
  });

export const addCalorieLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(addLogInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dog = await ensureDog(context.userId);
    await sql`
      insert into calorie_logs (user_id, dog_id, log_date, label, kcal, kind, food_id, amount, unit)
      values (
        ${context.userId},
        ${dog.id},
        ${data.date},
        ${data.label},
        ${data.kcal},
        ${data.kind},
        ${data.foodId},
        ${data.amount},
        ${data.unit}
      )
    `;
    return loadState(context.userId, data.date);
  });

export const deleteCalorieLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idDateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from calorie_logs
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return loadState(context.userId, data.date);
  });
