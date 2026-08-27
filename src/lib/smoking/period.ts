export const PERIOD_MS = 24 * 60 * 60 * 1000;

export function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value.toISOString() : null;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function applyReset(
  dailyLimit: number,
  remaining: number,
  periodStartedAt: string,
  now = Date.now(),
): { remaining: number; periodStartedAt: string; didReset: boolean } {
  const start = Date.parse(periodStartedAt);
  if (!Number.isFinite(start)) {
    return {
      remaining: dailyLimit,
      periodStartedAt: new Date(now).toISOString(),
      didReset: true,
    };
  }
  const elapsed = now - start;
  if (elapsed < PERIOD_MS) {
    return { remaining, periodStartedAt, didReset: false };
  }
  const periods = Math.floor(elapsed / PERIOD_MS);
  return {
    remaining: dailyLimit,
    periodStartedAt: new Date(start + periods * PERIOD_MS).toISOString(),
    didReset: true,
  };
}

export function resetsAtIso(periodStartedAt: string): string {
  const start = Date.parse(periodStartedAt);
  const base = Number.isFinite(start) ? start : Date.now();
  return new Date(base + PERIOD_MS).toISOString();
}

export function formatJaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
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
