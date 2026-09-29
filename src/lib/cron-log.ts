import type { Sql } from "@/lib/db";

export async function startCronRun(sql: Sql): Promise<number | null> {
  try {
    await sql`delete from cron_runs where started_at < now() - interval '30 days'`;
    const rows = await sql<{ id: number }>`
      insert into cron_runs (job, log) values ('daily', '') returning id
    `;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function appendCronLog(sql: Sql, id: number | null, line: string) {
  console.log(line);
  if (id == null) return;
  try {
    await sql`
      update cron_runs
      set log = log || ${`${line}\n`}
      where id = ${id}
    `;
  } catch {
    // 記録の失敗で処理自体は止めない
  }
}

export async function finishCronRun(sql: Sql, id: number | null, ok: boolean) {
  if (id == null) return;
  try {
    await sql`
      update cron_runs
      set finished_at = now(), ok = ${ok}
      where id = ${id}
    `;
  } catch {
    // 記録の失敗で結果の返却は止めない
  }
}
