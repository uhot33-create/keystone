import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

export type WalkLog = {
  id: string;
  name: string;
  startedAt: string | null;
  elapsedSec: number;
  distanceM: number;
  summaryPolyline: string | null;
  sourceName: string | null;
};

export type WalkMonthSummary = {
  yearMonth: string;
  year: number;
  month: number;
  distanceM: number;
  elapsedSec: number;
  logs: WalkLog[];
};

export type WalkYearGroup = {
  year: number;
  months: WalkMonthSummary[];
};

export type WalkLogList = {
  years: WalkYearGroup[];
  undated: WalkLog[];
};

export type WalkMonthRegion = {
  label: string;
  distanceM: number;
  elapsedSec: number;
  logCount: number;
  polylines: string[];
};

export type WalkMonthTrack = {
  yearMonth: string;
  distanceM: number;
  elapsedSec: number;
  logCount: number;
  polylines: string[];
  regions: WalkMonthRegion[];
};

export type WalkLogDetail = WalkLog & {
  prevId: string | null;
  nextId: string | null;
};

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  }
  return result.data;
}

function asIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

type LogRow = {
  id: string;
  name: string;
  started_at: unknown;
  elapsed_sec: unknown;
  distance_m: unknown;
  summary_polyline: string | null;
  source_name: string | null;
};

function mapLog(row: LogRow): WalkLog {
  return {
    id: row.id,
    name: row.name,
    startedAt: asIso(row.started_at),
    elapsedSec: Number(row.elapsed_sec) || 0,
    distanceM: Number(row.distance_m) || 0,
    summaryPolyline: row.summary_polyline,
    sourceName: row.source_name,
  };
}

function jstYearMonth(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(date);
  return /^\d{4}-\d{2}/.test(key) ? key.slice(0, 7) : null;
}

export function groupWalkLogs(logs: WalkLog[]): WalkLogList {
  const months = new Map<string, WalkLog[]>();
  const undated: WalkLog[] = [];
  for (const log of logs) {
    const key = jstYearMonth(log.startedAt);
    if (!key) {
      undated.push(log);
      continue;
    }
    const list = months.get(key) ?? [];
    list.push(log);
    months.set(key, list);
  }
  const keys = [...months.keys()].sort((a, b) => b.localeCompare(a));
  const years: WalkYearGroup[] = [];
  for (const key of keys) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const items = months.get(key) ?? [];
    const summary: WalkMonthSummary = {
      yearMonth: key,
      year,
      month,
      distanceM: items.reduce((sum, log) => sum + log.distanceM, 0),
      elapsedSec: items.reduce((sum, log) => sum + log.elapsedSec, 0),
      logs: items,
    };
    const yearGroup = years.find((item) => item.year === year);
    if (yearGroup) yearGroup.months.push(summary);
    else years.push({ year, months: [summary] });
  }
  return { years, undated };
}

function asRegions(value: unknown): WalkMonthRegion[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? safeJson(value) : [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const polylines = asTracks(row.polylines);
    if (polylines.length === 0) return [];
    return [
      {
        label: typeof row.label === "string" && row.label ? row.label : "地域",
        distanceM: Number(row.distanceM) || 0,
        elapsedSec: Number(row.elapsedSec) || 0,
        logCount: Number(row.logCount) || polylines.length,
        polylines,
      },
    ];
  });
}

function asTracks(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? safeJson(value) : [];
  return list.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function safeJson(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function listLogs(userId: string): Promise<WalkLogList> {
  const sql = await getSql();
  const rows = await sql<LogRow>`
    select id, name, started_at, elapsed_sec, distance_m, null::text as summary_polyline, source_name
    from walk_logs
    where user_id = ${userId}
    order by started_at desc nulls last, created_at desc
  `;
  return groupWalkLogs(rows.map(mapLog));
}

export const getWalkLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listLogs(context.userId));

export const getWalkLog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const ids = await sql<{ id: string }>`
      select id
      from walk_logs
      where user_id = ${context.userId}
      order by started_at desc nulls last, created_at desc
    `;
    const index = ids.findIndex((row) => row.id === data.id);
    if (index < 0) throw new Error("記録がありません");
    const rows = await sql<LogRow>`
      select id, name, started_at, elapsed_sec, distance_m, summary_polyline, source_name
      from walk_logs
      where id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("記録がありません");
    return {
      ...mapLog(row),
      nextId: index > 0 ? ids[index - 1]!.id : null,
      prevId: index < ids.length - 1 ? ids[index + 1]!.id : null,
    };
  });

const saveInput = z.object({
  name: z.string().trim().min(1, "名前がありません").max(80),
  startedAt: z.string().nullable(),
  elapsedSec: z.number().int().min(0).max(7 * 24 * 3600),
  distanceM: z.number().min(0).max(1_000_000),
  summaryPolyline: z.string().min(1, "軌跡がありません").max(80_000),
  sourceName: z.string().max(120),
});

export const saveWalkLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(saveInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into walk_logs (
        id, user_id, name, started_at, elapsed_sec, distance_m, summary_polyline, source_name
      )
      values (
        ${id},
        ${context.userId},
        ${data.name},
        ${data.startedAt},
        ${data.elapsedSec},
        ${data.distanceM},
        ${data.summaryPolyline},
        ${data.sourceName || null}
      )
    `;
    return listLogs(context.userId);
  });

export const deleteWalkLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from walk_logs where id = ${data.id} and user_id = ${context.userId}`;
    return listLogs(context.userId);
  });

export const getWalkMonth = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "月の指定が正しくありません") }), input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await loadMonth(sql, context.userId, data.yearMonth);
    const row = rows[0];
    if (!row) throw new Error("この月の地図は、毎日0時の集計のあと表示されます");
    return {
      yearMonth: data.yearMonth,
      distanceM: Number(row.distance_m) || 0,
      elapsedSec: Number(row.elapsed_sec) || 0,
      logCount: Number(row.log_count) || 0,
      polylines: asTracks(row.polylines),
      regions: asRegions(row.regions),
    } satisfies WalkMonthTrack;
  });

async function loadMonth(sql: Sql, userId: string, yearMonth: string) {
  return sql<{
    distance_m: unknown;
    elapsed_sec: unknown;
    log_count: unknown;
    polylines: unknown;
    regions: unknown;
  }>`
    select distance_m, elapsed_sec, log_count, polylines, regions
    from walk_month_tracks
    where user_id = ${userId} and year_month = ${yearMonth}
    limit 1
  `;
}
