import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type WalkLog = {
  id: string;
  name: string;
  startedAt: string | null;
  elapsedSec: number;
  distanceM: number;
  summaryPolyline: string | null;
  sourceName: string | null;
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

async function listLogs(userId: string): Promise<WalkLog[]> {
  const sql = await getSql();
  const rows = await sql<LogRow>`
    select id, name, started_at, elapsed_sec, distance_m, summary_polyline, source_name
    from walk_logs
    where user_id = ${userId}
    order by started_at desc nulls last, created_at desc
    limit 100
  `;
  return rows.map(mapLog);
}

export const getWalkLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listLogs(context.userId));

export const getWalkLog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<LogRow>`
      select id, name, started_at, elapsed_sec, distance_m, summary_polyline, source_name
      from walk_logs
      where id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("記録がありません");
    return mapLog(row);
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
