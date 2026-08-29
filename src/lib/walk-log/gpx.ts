const MAX_GPX_BYTES = 8 * 1024 * 1024;
const MAX_POINTS = 1500;

export type ParsedGpx = {
  name: string;
  startedAt: string | null;
  elapsedSec: number;
  distanceM: number;
  summaryPolyline: string;
  sourceName: string;
};

export async function parseGpxFile(file: File): Promise<ParsedGpx> {
  if (file.size > MAX_GPX_BYTES) {
    throw new Error("GPX は 8MB 以下にしてください");
  }
  const text = await file.text();
  if (!text.includes("<gpx") && !text.includes("<GPX")) {
    throw new Error("GPX ファイルを選んでください");
  }
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("GPX を読み込めませんでした");
  }
  const nodes = [
    ...Array.from(doc.querySelectorAll("trkpt")),
    ...Array.from(doc.querySelectorAll("rtept")),
  ];
  const points: [number, number][] = [];
  const times: number[] = [];
  for (const node of nodes) {
    const lat = Number(node.getAttribute("lat"));
    const lon = Number(node.getAttribute("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    points.push([lat, lon]);
    const timeText = node.querySelector("time")?.textContent?.trim();
    const ms = timeText ? Date.parse(timeText) : NaN;
    if (Number.isFinite(ms)) times.push(ms);
  }
  if (points.length < 2) {
    throw new Error("軌跡の点が足りません。別の GPX を試してください");
  }
  const sampled = downsample(points, MAX_POINTS);
  const nameFromXml =
    doc.querySelector("trk > name")?.textContent?.trim() ||
    doc.querySelector("metadata > name")?.textContent?.trim() ||
    "";
  const sourceName = file.name.replace(/\.gpx$/i, "") || "散歩";
  const startedMs = times[0];
  const endedMs = times[times.length - 1];
  return {
    name: (nameFromXml || sourceName).slice(0, 80),
    startedAt: Number.isFinite(startedMs) ? new Date(startedMs).toISOString() : null,
    elapsedSec:
      Number.isFinite(startedMs) && Number.isFinite(endedMs) && endedMs >= startedMs
        ? Math.round((endedMs - startedMs) / 1000)
        : 0,
    distanceM: Math.round(pathDistance(points) * 10) / 10,
    summaryPolyline: encodePolyline(sampled),
    sourceName: file.name.slice(0, 120),
  };
}

function downsample(points: [number, number][], max: number): [number, number][] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < max; i += 1) {
    out.push(points[Math.round(i * step)]!);
  }
  return out;
}

function pathDistance(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversine(points[i - 1]!, points[i]!);
  }
  return total;
}

function haversine(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    lat += readDelta();
    lng += readDelta();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;

  function readDelta(): number {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}

function encodePolyline(points: [number, number][]): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    out += encodeDelta(latE5 - prevLat);
    out += encodeDelta(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out;
}

function encodeDelta(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let s = "";
  while (v >= 0x20) {
    s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  s += String.fromCharCode(v + 63);
  return s;
}
