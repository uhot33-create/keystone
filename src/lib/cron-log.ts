/**
 * 定期処理（cron）の開始・ログ追記・終了を cron_runs に残す。
 * 開始時に 30 日より古い行を消す。ログの書き込みに失敗しても本処理は止めない。
 * ジョブ名はいま "daily" 固定。残す日数を変えるときは delete の interval。
 */
import type { Sql } from "@/lib/db";

/** 実行行を作り、その id を返す。失敗したら null（処理は続ける）。 */
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

/** コンソールと DB の両方に1行足す。id が null ならコンソールだけ。 */
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

/** 終了時刻と成否を書く。id が null なら何もしない。 */
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
