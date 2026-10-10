/**
 * 散歩ログの軌跡から町名を取る。サーバー専用。
 * 保存時（saveWalkLog）に軌跡の中心を逆ジオコードし、ログ名に使う。
 * 画面は散歩ログの取り込み。失敗したら GPX の名前のまま残る。
 * API は HeartRails Geo。タイムアウトは 4 秒。名前は 80 文字まで。
 * 地図で線を切る距離はここではない。gpx.ts の TRACK_GAP_M。
 */
import { decodePolyline } from "@/lib/walk-log/gpx";

/** 軌跡を囲む範囲の中心。 */
export function polylineCenter(encoded: string): { lat: number; lng: number } | null {
  const points = decodePolyline(encoded);
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
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

/** 中心に一番近い町名。失敗したら null。 */
export async function addressAtCenter(encoded: string): Promise<string | null> {
  const center = polylineCenter(encoded);
  if (!center) return null;
  const url = `https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${center.lng}&y=${center.lat}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    response?: { location?: Array<{ prefecture?: string; city?: string; town?: string }> };
  };
  const place = json.response?.location?.[0];
  if (!place) return null;
  const name = `${place.prefecture ?? ""}${place.city ?? ""}${place.town ?? ""}`.trim();
  return name ? name.slice(0, 80) : null;
}
