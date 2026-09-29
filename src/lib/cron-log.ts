import type { Sql } from "@/lib/db";

export type CronRunLog = {
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  smokingUsers: number | null;
  smokingError: string | null;
  calorieDogs: number | null;
  calorieError: string | null;
};

type RunRow = {
  id: number;
  started_at: unknown;
  finished_at: unknown;
  ok: boolean;
  smoking_users: number | null;
  smoking_error: string | null;
  calorie_dogs: number | null;
  calorie_error: string | null;
};

function asIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

export async function startCronRun(sql: Sql): Promise<number | null> {
  try {
    await sql`delete from cron_runs where started_at < now() - interval '30 days'`;
    const rows = await sql<{ id: number }>`
      insert into cron_runs (job) values ('daily') returning id
    `;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function saveSmokingCron(sql: Sql, id: number | null, users: number | null, error: string | null) {
  if (id == null) return;
  try {
    await sql`
      update cron_runs
      set smoking_users = ${users}, smoking_error = ${error}
      where id = ${id}
    `;
  } catch {
    // 記録の失敗でリセット自体は止めない
  }
}

export async function finishCronRun(
  sql: Sql,
  id: number | null,
  ok: boolean,
  dogs: number | null,
  error: string | null,
) {
  if (id == null) return;
  try {
    await sql`
      update cron_runs
      set finished_at = now(), ok = ${ok}, calorie_dogs = ${dogs}, calorie_error = ${error}
      where id = ${id}
    `;
  } catch {
    // 記録の失敗で集計結果の返却は止めない
  }
}

export function mapCronRun(row: RunRow | undefined): CronRunLog | null {
  if (!row) return null;
  const startedAt = asIso(row.started_at);
  if (!startedAt) return null;
  return {
    startedAt,
    finishedAt: asIso(row.finished_at),
    ok: Boolean(row.ok),
    smokingUsers: row.smoking_users,
    smokingError: row.smoking_error,
    calorieDogs: row.calorie_dogs,
    calorieError: row.calorie_error,
  };
}

export async function latestCronRun(sql: Sql): Promise<CronRunLog | null> {
  const rows = await sql<RunRow>`
    select id, started_at, finished_at, ok, smoking_users, smoking_error, calorie_dogs, calorie_error
    from cron_runs
    where job = 'daily'
    order by id desc
    limit 1
  `;
  return mapCronRun(rows[0]);
}
