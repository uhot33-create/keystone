import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { applyClosedDay, convertStoredNices, eachJstDay, emptyBadges, yesterdayJst } from "./badges";
import { applyReset, clampRemaining, jstDateKey, resetsAtIso, toIso } from "./period";
import type { SmokingBadges, SmokingState } from "./types";

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

function asDateKey(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return jstDateKey(value.getTime());
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

type SettingsRow = {
  daily_limit: unknown;
  remaining: unknown;
  period_started_at: unknown;
  last_smoked_at: unknown;
  exceeded: unknown;
};

type BadgeRow = {
  nice_count: unknown;
  very_nice_count: unknown;
  wonderful_count: unknown;
  last_evaluated_on: unknown;
  lifetime_nice: unknown;
  streak: unknown;
  zero_streak: unknown;
  light_count: unknown;
  zero_count: unknown;
  quiet_week_count: unknown;
  recover_count: unknown;
  limit_down_count: unknown;
  start_earned: unknown;
  week_earned: unknown;
  month_earned: unknown;
  hundred_earned: unknown;
  last_was_exceeded: unknown;
};

function mapBadges(row: BadgeRow | undefined): SmokingBadges {
  if (!row) return emptyBadges();
  return convertStoredNices({
    niceCount: int(row.nice_count),
    veryNiceCount: int(row.very_nice_count),
    wonderfulCount: int(row.wonderful_count),
    lastEvaluatedOn: asDateKey(row.last_evaluated_on),
    lifetimeNice: int(row.lifetime_nice),
    streak: int(row.streak),
    zeroStreak: int(row.zero_streak),
    lightCount: int(row.light_count),
    zeroCount: int(row.zero_count),
    quietWeekCount: int(row.quiet_week_count),
    recoverCount: int(row.recover_count),
    limitDownCount: int(row.limit_down_count),
    startEarned: Boolean(row.start_earned),
    weekEarned: Boolean(row.week_earned),
    monthEarned: Boolean(row.month_earned),
    hundredEarned: Boolean(row.hundred_earned),
    lastWasExceeded: Boolean(row.last_was_exceeded),
  });
}

function toState(row: SettingsRow, badges: SmokingBadges): SmokingState {
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
    exceeded: Boolean(row.exceeded) && !reset.didReset,
    badges,
  };
}

async function ensureRow(userId: string): Promise<SettingsRow> {
  const sql = await getSql();
  const existing = await sql<SettingsRow>`
    select daily_limit, remaining, period_started_at, last_smoked_at, exceeded
    from smoking_settings
    where user_id = ${userId}
    limit 1
  `;
  if (existing[0]) return existing[0];

  const created = await sql<SettingsRow>`
    insert into smoking_settings (user_id, daily_limit, remaining)
    values (${userId}, 10, 10)
    returning daily_limit, remaining, period_started_at, last_smoked_at, exceeded
  `;
  const row = created[0];
  if (!row) throw new Error("設定を作成できませんでした");
  return row;
}

async function loadBadgeRow(userId: string): Promise<BadgeRow | undefined> {
  const sql = await getSql();
  const rows = await sql<BadgeRow>`
    select
      nice_count, very_nice_count, wonderful_count, last_evaluated_on,
      lifetime_nice, streak, zero_streak, light_count, zero_count, quiet_week_count,
      recover_count, limit_down_count, start_earned, week_earned, month_earned,
      hundred_earned, last_was_exceeded
    from smoking_badges
    where user_id = ${userId}
    limit 1
  `;
  return rows[0];
}

async function saveBadges(userId: string, badges: SmokingBadges) {
  const sql = await getSql();
  await sql`
    insert into smoking_badges (
      user_id, nice_count, very_nice_count, wonderful_count, last_evaluated_on,
      lifetime_nice, streak, zero_streak, light_count, zero_count, quiet_week_count,
      recover_count, limit_down_count, start_earned, week_earned, month_earned,
      hundred_earned, last_was_exceeded, updated_at
    )
    values (
      ${userId},
      ${badges.niceCount},
      ${badges.veryNiceCount},
      ${badges.wonderfulCount},
      ${badges.lastEvaluatedOn},
      ${badges.lifetimeNice},
      ${badges.streak},
      ${badges.zeroStreak},
      ${badges.lightCount},
      ${badges.zeroCount},
      ${badges.quietWeekCount},
      ${badges.recoverCount},
      ${badges.limitDownCount},
      ${badges.startEarned},
      ${badges.weekEarned},
      ${badges.monthEarned},
      ${badges.hundredEarned},
      ${badges.lastWasExceeded},
      now()
    )
    on conflict (user_id) do update set
      nice_count = excluded.nice_count,
      very_nice_count = excluded.very_nice_count,
      wonderful_count = excluded.wonderful_count,
      last_evaluated_on = excluded.last_evaluated_on,
      lifetime_nice = excluded.lifetime_nice,
      streak = excluded.streak,
      zero_streak = excluded.zero_streak,
      light_count = excluded.light_count,
      zero_count = excluded.zero_count,
      quiet_week_count = excluded.quiet_week_count,
      recover_count = excluded.recover_count,
      limit_down_count = excluded.limit_down_count,
      start_earned = excluded.start_earned,
      week_earned = excluded.week_earned,
      month_earned = excluded.month_earned,
      hundred_earned = excluded.hundred_earned,
      last_was_exceeded = excluded.last_was_exceeded,
      updated_at = now()
  `;
}

async function settleBadges(userId: string, raw: SettingsRow, didReset: boolean): Promise<SmokingBadges> {
  const yesterday = yesterdayJst();
  const current = mapBadges(await loadBadgeRow(userId));
  if (!didReset) return current;

  if (!current.lastEvaluatedOn) {
    const started: SmokingBadges = { ...current, lastEvaluatedOn: yesterday };
    await saveBadges(userId, started);
    return started;
  }

  const periodKey = toIso(raw.period_started_at)
    ? jstDateKey(Date.parse(toIso(raw.period_started_at)!))
    : yesterday;
  const exceeded = Boolean(raw.exceeded);
  const days = eachJstDay(current.lastEvaluatedOn, yesterday);
  if (days.length === 0) return current;

  const dailyLimit = Math.max(1, int(raw.daily_limit) || 10);
  const remaining = clampRemaining(int(raw.remaining), dailyLimit);
  let next = current;
  for (const day of days) {
    const isPeriod = day === periodKey;
    next = applyClosedDay(next, {
      skipped: !isPeriod,
      exceeded: isPeriod ? exceeded : false,
      remaining: isPeriod ? remaining : dailyLimit,
      dailyLimit,
    });
  }
  next = { ...next, lastEvaluatedOn: yesterday };
  await saveBadges(userId, next);
  return next;
}

async function loadState(userId: string): Promise<SmokingState> {
  const sql = await getSql();
  const raw = await ensureRow(userId);
  const periodIso = toIso(raw.period_started_at) ?? "";
  const remainingNow = clampRemaining(int(raw.remaining), Math.max(1, int(raw.daily_limit) || 10));
  const reset = applyReset(Math.max(1, int(raw.daily_limit) || 10), remainingNow, periodIso || new Date().toISOString());
  const badges = await settleBadges(userId, raw, reset.didReset);

  const periodChanged = reset.periodStartedAt !== periodIso;
  const remainingChanged = reset.remaining !== int(raw.remaining);
  const exceededChanged = reset.didReset && Boolean(raw.exceeded);
  if (periodChanged || remainingChanged || exceededChanged) {
    await sql`
      update smoking_settings
      set
        remaining = ${reset.remaining},
        period_started_at = ${reset.periodStartedAt},
        exceeded = ${reset.didReset ? false : Boolean(raw.exceeded)},
        updated_at = now()
      where user_id = ${userId}
    `;
  }
  const latest = await ensureRow(userId);
  return toState(latest, badges);
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
    const lowered = dailyLimit < current.dailyLimit;
    remaining = clampRemaining(remaining, dailyLimit);
    await sql`
      update smoking_settings
      set
        daily_limit = ${dailyLimit},
        remaining = ${remaining},
        updated_at = now()
      where user_id = ${context.userId}
    `;
    if (lowered) {
      const badges = { ...current.badges, limitDownCount: current.badges.limitDownCount + 1 };
      await saveBadges(context.userId, badges);
    }
    return loadState(context.userId);
  });

export const smokeOne = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const current = await loadState(context.userId);
    if (current.remaining <= 0) {
      await sql`
        update smoking_settings
        set exceeded = true, last_smoked_at = ${new Date().toISOString()}, updated_at = now()
        where user_id = ${context.userId}
      `;
      return loadState(context.userId);
    }
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
