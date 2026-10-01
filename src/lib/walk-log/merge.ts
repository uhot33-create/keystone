import type { Sql } from "@/lib/db";
import { decodePolyline } from "@/lib/walk-log/gpx";

/** 軌跡の中心が同じ5km四方なら、同じ地図に載せる。 */
const REGION_CELL_M = 5_000;

const PREFECTURES: ReadonlyArray<readonly [string, number, number]> = [
  ["北海道", 43.06, 141.35],
  ["青森県", 40.82, 140.74],
  ["岩手県", 39.7, 141.15],
  ["宮城県", 38.27, 140.87],
  ["秋田県", 39.72, 140.1],
  ["山形県", 38.24, 140.36],
  ["福島県", 37.75, 140.47],
  ["茨城県", 36.34, 140.45],
  ["栃木県", 36.57, 139.88],
  ["群馬県", 36.39, 139.06],
  ["埼玉県", 35.86, 139.65],
  ["千葉県", 35.61, 140.12],
  ["東京都", 35.69, 139.69],
  ["神奈川県", 35.45, 139.64],
  ["新潟県", 37.9, 139.02],
  ["富山県", 36.7, 137.21],
  ["石川県", 36.59, 136.63],
  ["福井県", 36.07, 136.22],
  ["山梨県", 35.66, 138.57],
  ["長野県", 36.65, 138.18],
  ["岐阜県", 35.39, 136.72],
  ["静岡県", 34.98, 138.38],
  ["愛知県", 35.18, 136.91],
  ["三重県", 34.73, 136.51],
  ["滋賀県", 35.0, 135.87],
  ["京都府", 35.02, 135.76],
  ["大阪府", 34.69, 135.52],
  ["兵庫県", 34.69, 135.18],
  ["奈良県", 34.69, 135.83],
  ["和歌山県", 34.23, 135.17],
  ["鳥取県", 35.5, 134.24],
  ["島根県", 35.47, 133.05],
  ["岡山県", 34.66, 133.93],
  ["広島県", 34.4, 132.46],
  ["山口県", 34.19, 131.47],
  ["徳島県", 34.07, 134.56],
  ["香川県", 34.34, 134.04],
  ["愛媛県", 33.84, 132.77],
  ["高知県", 33.56, 133.53],
  ["福岡県", 33.61, 130.42],
  ["佐賀県", 33.25, 130.3],
  ["長崎県", 32.75, 129.87],
  ["熊本県", 32.79, 130.74],
  ["大分県", 33.24, 131.61],
  ["宮崎県", 31.91, 131.42],
  ["鹿児島県", 31.56, 130.56],
  ["沖縄県", 26.21, 127.68],
];

type TrackRow = {
  user_id: string;
  year_month: string;
  distance_m: unknown;
  elapsed_sec: unknown;
  summary_polyline: string | null;
};

export type MonthRegion = {
  label: string;
  distanceM: number;
  elapsedSec: number;
  logCount: number;
  polylines: string[];
};

type Bucket = {
  userId: string;
  yearMonth: string;
  distanceM: number;
  elapsedSec: number;
  logCount: number;
  polylines: string[];
  regions: MonthRegion[];
};

type Box = { minLat: number; maxLat: number; minLng: number; maxLng: number };

type Piece = {
  distanceM: number;
  elapsedSec: number;
  polyline: string;
  box: Box;
};

/** 各散歩の軌跡はそのまま並べる。離れた地域は別の地図にする。 */
export function bucketMonthTracks(rows: TrackRow[]): Bucket[] {
  const map = new Map<string, { bucket: Bucket; pieces: Piece[] }>();
  for (const row of rows) {
    const yearMonth = String(row.year_month ?? "");
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) continue;
    const key = `${row.user_id}\0${yearMonth}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        bucket: {
          userId: String(row.user_id),
          yearMonth,
          distanceM: 0,
          elapsedSec: 0,
          logCount: 0,
          polylines: [],
          regions: [],
        },
        pieces: [],
      };
      map.set(key, entry);
    }
    const distanceM = Number(row.distance_m) || 0;
    const elapsedSec = Number(row.elapsed_sec) || 0;
    entry.bucket.distanceM += distanceM;
    entry.bucket.elapsedSec += elapsedSec;
    entry.bucket.logCount += 1;
    const polyline = row.summary_polyline;
    if (!polyline) continue;
    const box = boxOf(decodePolyline(polyline));
    if (!box) continue;
    entry.bucket.polylines.push(polyline);
    entry.pieces.push({ distanceM, elapsedSec, polyline, box });
  }
  return [...map.values()].map(({ bucket, pieces }) => {
    bucket.regions = labelRegions(clusterPieces(pieces));
    bucket.distanceM = Math.round(bucket.distanceM * 10) / 10;
    bucket.elapsedSec = Math.round(bucket.elapsedSec);
    return bucket;
  });
}

function clusterPieces(pieces: Piece[]): Array<MonthRegion & { box: Box }> {
  const groups = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const key = cellKey(piece.box);
    const list = groups.get(key) ?? [];
    list.push(piece);
    groups.set(key, list);
  }
  return [...groups.values()].map((group) => ({
    label: "",
    distanceM: Math.round(group.reduce((sum, piece) => sum + piece.distanceM, 0) * 10) / 10,
    elapsedSec: Math.round(group.reduce((sum, piece) => sum + piece.elapsedSec, 0)),
    logCount: group.length,
    polylines: group.map((piece) => piece.polyline),
    box: group.reduce((box, piece) => unite(box, piece.box), group[0]!.box),
  }));
}

function cellKey(box: Box): string {
  const lat = (box.minLat + box.maxLat) / 2;
  const lng = (box.minLng + box.maxLng) / 2;
  const latM = lat * 111_320;
  const lngM = lng * 111_320 * Math.cos((lat * Math.PI) / 180);
  return `${Math.floor(latM / REGION_CELL_M)}:${Math.floor(lngM / REGION_CELL_M)}`;
}

function labelRegions(regions: Array<MonthRegion & { box: Box }>): MonthRegion[] {
  const named = regions
    .map((region) => ({ ...region, label: nearestPrefecture(region.box) }))
    .sort((a, b) => b.distanceM - a.distanceM);
  const counts = new Map<string, number>();
  for (const region of named) counts.set(region.label, (counts.get(region.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return named.map(({ box: _box, ...region }) => {
    if ((counts.get(region.label) ?? 0) < 2) return region;
    const index = (seen.get(region.label) ?? 0) + 1;
    seen.set(region.label, index);
    return { ...region, label: `${region.label}（${index}）` };
  });
}

function nearestPrefecture(box: Box): string {
  const lat = (box.minLat + box.maxLat) / 2;
  const lng = (box.minLng + box.maxLng) / 2;
  let best = PREFECTURES[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const prefecture of PREFECTURES) {
    const distance = boxGapMeters(
      { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng },
      { minLat: prefecture[1], maxLat: prefecture[1], minLng: prefecture[2], maxLng: prefecture[2] },
    );
    if (distance < bestDistance) {
      best = prefecture;
      bestDistance = distance;
    }
  }
  return best[0];
}

function boxOf(points: [number, number][]): Box | null {
  if (points.length === 0) return null;
  let minLat = points[0]![0];
  let maxLat = minLat;
  let minLng = points[0]![1];
  let maxLng = minLng;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function unite(a: Box, b: Box): Box {
  return {
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
    minLng: Math.min(a.minLng, b.minLng),
    maxLng: Math.max(a.maxLng, b.maxLng),
  };
}

function boxGapMeters(a: Box, b: Box): number {
  const latGap = a.minLat > b.maxLat ? a.minLat - b.maxLat : b.minLat > a.maxLat ? b.minLat - a.maxLat : 0;
  const lngGap = a.minLng > b.maxLng ? a.minLng - b.maxLng : b.minLng > a.maxLng ? b.minLng - a.maxLng : 0;
  if (latGap === 0 && lngGap === 0) return 0;
  const midLat = (((a.minLat + a.maxLat + b.minLat + b.maxLat) / 4) * Math.PI) / 180;
  const dy = latGap * 111_320;
  const dx = lngGap * 111_320 * Math.cos(midLat);
  return Math.hypot(dx, dy);
}

async function loadTracks(sql: Sql): Promise<TrackRow[]> {
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

async function writeBuckets(sql: Sql, buckets: Bucket[]) {
  await sql`delete from walk_month_tracks`;
  for (const bucket of buckets) {
    await sql`
      insert into walk_month_tracks (
        user_id, year_month, distance_m, elapsed_sec, log_count, polylines, regions, computed_at
      )
      values (
        ${bucket.userId},
        ${bucket.yearMonth},
        ${bucket.distanceM},
        ${bucket.elapsedSec},
        ${bucket.logCount},
        ${JSON.stringify(bucket.polylines)}::jsonb,
        ${JSON.stringify(bucket.regions)}::jsonb,
        now()
      )
    `;
  }
}

export async function rebuildAllWalkMonths(sql: Sql): Promise<{ months: number; users: number }> {
  const buckets = bucketMonthTracks(await loadTracks(sql));
  await writeBuckets(sql, buckets);
  return {
    months: buckets.length,
    users: new Set(buckets.map((bucket) => bucket.userId)).size,
  };
}
