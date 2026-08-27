const JST = "Asia/Tokyo";

export function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value.toISOString() : null;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function jstDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function startOfJstDayIso(ms: number): string {
  const key = jstDateKey(ms);
  return new Date(`${key}T00:00:00+09:00`).toISOString();
}

export function nextJstMidnightIso(ms: number): string {
  const start = Date.parse(startOfJstDayIso(ms));
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}

export function applyReset(
  dailyLimit: number,
  remaining: number,
  periodStartedAt: string,
  now = Date.now(),
): { remaining: number; periodStartedAt: string; didReset: boolean } {
  const todayStart = startOfJstDayIso(now);
  const start = Date.parse(periodStartedAt);
  if (!Number.isFinite(start)) {
    return { remaining: dailyLimit, periodStartedAt: todayStart, didReset: true };
  }
  if (jstDateKey(start) === jstDateKey(now)) {
    return { remaining, periodStartedAt: todayStart, didReset: false };
  }
  return { remaining: dailyLimit, periodStartedAt: todayStart, didReset: true };
}

export function resetsAtIso(_periodStartedAt: string, now = Date.now()): string {
  return nextJstMidnightIso(now);
}

export function formatJaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "まもなくリセット";
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `あと ${hours}時間${minutes}分`;
  return `あと ${minutes}分`;
}

export function clampRemaining(value: number, dailyLimit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(dailyLimit, Math.max(0, Math.round(value)));
}
