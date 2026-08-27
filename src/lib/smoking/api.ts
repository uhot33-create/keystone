import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { applyReset, clampRemaining, resetsAtIso, toIso } from "./period";
import type { SmokingState } from "./types";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  }
  return result.data;
}

function int(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

type SettingsRow = {
  daily_limit: unknown;
  remaining: unknown;
  period_started_at: unknown;
  last_smoked_at: unknown;
};

function toState(row: SettingsRow): SmokingState {
  const dailyLimit = Math.max(1, int(row.daily_limit) || 10);
  const periodStartedAt = toIso(row.period_started_at) ?? new Date().toISOString();
  const remaining = clampRemaining(int(row.remaining), dailyLimit);
  const reset = applyReset(dailyLimit, remaining, periodStartedAt);
  return {
    dailyLimit,
    remaining: reset.remaining,
    periodStartedAt: reset.periodStartedAt,
    lastSmokedAt: toIso(row.last_smoked_at),
    resetsAt: resetsAtIso(reset.periodStartedAt),
  };
}

async function ensureRow(userId: string): Promise<SettingsRow> {
  const sql = await getSql();
  const existing = await sql<SettingsRow>`
    select daily_limit, remaining, period_started_at, last_smoked_at
    from smoking_settings
    where user_id = ${userId}
    limit 1
  `;
  if (existing[0]) return existing[0];

  const created = await sql<SettingsRow>`
    insert into smoking_settings (user_id, daily_limit, remaining)
    values (${userId}, 10, 10)
    returning daily_limit, remaining, period_started_at, last_smoked_at
  `;
  const row = created[0];
  if (!row) throw new Error("設定を作成できませんでした");
  return row;
}

async function loadState(userId: string): Promise<SmokingState> {
  const sql = await getSql();
  const raw = await ensureRow(userId);
  const next = toState(raw);
  const periodChanged = next.periodStartedAt !== (toIso(raw.period_started_at) ?? "");
  const remainingChanged = next.remaining !== int(raw.remaining);
  if (periodChanged || remainingChanged) {
    await sql`
      update smoking_settings
      set
        remaining = ${next.remaining},
        period_started_at = ${next.periodStartedAt},
        updated_at = now()
      where user_id = ${userId}
    `;
  }
  return next;
}

export const getSmokingState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadState(context.userId));

const limitInput = z.object({
  dailyLimit: z
    .number()
    .int("整数で入力してください")
    .min(1, "1本以上にしてください")
    .max(80, "80本までにしてください"),
});

export const saveDailyLimit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(limitInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await loadState(context.userId);
    const dailyLimit = data.dailyLimit;
    let remaining = current.remaining;
    if (dailyLimit > current.dailyLimit) {
      remaining += dailyLimit - current.dailyLimit;
    }
    remaining = clampRemaining(remaining, dailyLimit);
    await sql`
      update smoking_settings
      set
        daily_limit = ${dailyLimit},
        remaining = ${remaining},
        updated_at = now()
      where user_id = ${context.userId}
    `;
    return loadState(context.userId);
  });

export const smokeOne = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const current = await loadState(context.userId);
    if (current.remaining <= 0) return current;
    const smokedAt = new Date().toISOString();
    await sql`
      update smoking_settings
      set
        remaining = remaining - 1,
        last_smoked_at = ${smokedAt},
        updated_at = now()
      where user_id = ${context.userId} and remaining > 0
    `;
    return loadState(context.userId);
  });

const remainingInput = z.object({
  remaining: z
    .number()
    .int("整数で入力してください")
    .min(0, "0本以上にしてください")
    .max(80, "80本までにしてください"),
});

export const setRemaining = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(remainingInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await loadState(context.userId);
    const remaining = clampRemaining(data.remaining, current.dailyLimit);
    await sql`
      update smoking_settings
      set remaining = ${remaining}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return loadState(context.userId);
  });
