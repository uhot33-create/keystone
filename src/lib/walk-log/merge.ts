import type { Sql } from "@/lib/db";

type TrackRow = {
  user_id: string;
  year_month: string;
  distance_m: unknown;
  elapsed_sec: unknown;
  summary_polyline: string | null;
};

type Bucket = {
  userId: string;
  yearMonth: string;
  distanceM: number;
  elapsedSec: number;
  logCount: number;
  polylines: string[];
};

/** 各散歩の軌跡はそのまま並べる。前後の散歩を一本の線にはしない。 */
export function bucketMonthTracks(rows: TrackRow[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const yearMonth = String(row.year_month ?? "");
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) continue;
    const key = `${row.user_id}\0${yearMonth}`;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { userId: String(row.user_id), yearMonth, distanceM: 0, elapsedSec: 0, logCount: 0, polylines: [] };
      map.set(key, bucket);
    }
    bucket.distanceM += Number(row.distance_m) || 0;
    bucket.elapsedSec += Number(row.elapsed_sec) || 0;
    bucket.logCount += 1;
    if (row.summary_polyline) bucket.polylines.push(row.summary_polyline);
  }
  return [...map.values()];
}

async function loadTracks(sql: Sql, userId?: string): Promise<TrackRow[]> {
  if (userId) {
    return sql<TrackRow>`
      select user_id,
        to_char(started_at at time zone 'Asia/Tokyo', 'YYYY-MM') as year_month,
        distance_m,
        elapsed_sec,
        summary_polyline
      from walk_logs
      where user_id = ${userId} and started_at is not null
      order by started_at
    `;
  }
  return sql<TrackRow>`
    select user_id,
      to_char(started_at at time zone 'Asia/Tokyo', 'YYYY-MM') as year_month,
      distance_m,
      elapsed_sec,
      summary_polyline
    from walk_logs
    where started_at is not null
    order by user_id, started_at
  `;
}

async function writeBuckets(sql: Sql, userId: string | undefined, buckets: Bucket[]) {
  if (userId) {
    await sql`delete from walk_month_tracks where user_id = ${userId}`;
  } else {
    await sql`delete from walk_month_tracks`;
  }
  for (const bucket of buckets) {
    await sql`
      insert into walk_month_tracks (
        user_id, year_month, distance_m, elapsed_sec, log_count, polylines, computed_at
      )
      values (
        ${bucket.userId},
        ${bucket.yearMonth},
        ${Math.round(bucket.distanceM * 10) / 10},
        ${Math.round(bucket.elapsedSec)},
        ${bucket.logCount},
        ${JSON.stringify(bucket.polylines)}::jsonb,
        now()
      )
    `;
  }
}

export async function rebuildUserWalkMonths(sql: Sql, userId: string): Promise<number> {
  const buckets = bucketMonthTracks(await loadTracks(sql, userId));
  await writeBuckets(sql, userId, buckets);
  return buckets.length;
}

export async function rebuildAllWalkMonths(sql: Sql): Promise<{ months: number; users: number }> {
  const buckets = bucketMonthTracks(await loadTracks(sql));
  await writeBuckets(sql, undefined, buckets);
  return {
    months: buckets.length,
    users: new Set(buckets.map((bucket) => bucket.userId)).size,
  };
}
