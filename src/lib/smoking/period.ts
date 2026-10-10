/**
 * 喫煙の1日の区切りと、画面用の時刻表示。
 * 画面は /smoking。リセットは日本時間の0時（次の深夜）。
 * タイムゾーンを変えるときは JST。0時の計算は startOfJstDayIso と nextJstMidnightIso。
 * applyReset は「期間の開始日が今日でなければ、残りを上限に戻す」。
 */
/** 日付の基準。日本時間。リセット時刻を変えるときの起点。 */
const JST = "Asia/Tokyo";

/** DBや入力の日時を ISO 文字列にする。空や不正なら null。 */
export function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value.toISOString() : null;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** ミリ秒を日本時間の YYYY-MM-DD にする。 */
export function jstDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** その瞬間が属する日本時間の0時を ISO にする。 */
export function startOfJstDayIso(ms: number): string {
  const key = jstDateKey(ms);
  return new Date(`${key}T00:00:00+09:00`).toISOString();
}

/** 次の日本時間0時。リセット時刻そのもの。 */
export function nextJstMidnightIso(ms: number): string {
  const start = Date.parse(startOfJstDayIso(ms));
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}

/**
 * 日付が変わっていたら残りを上限に戻す。
 * 期間開始が今日なら何もしない（didReset は false）。
 */
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

/** 次に本数が戻る時刻。いまから見た次の日本時間0時。 */
export function resetsAtIso(_periodStartedAt: string, now = Date.now()): string {
  return nextJstMidnightIso(now);
}

/** ISO を「2026年10月10日 09:00」のように出す。 */
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

/** リセットまでの残りを「あと 3時間5分」と出す。0以下は「まもなくリセット」。 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "まもなくリセット";
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `あと ${hours}時間${minutes}分`;
  return `あと ${minutes}分`;
}

/** 残り本数を 0〜上限の整数に収める。 */
export function clampRemaining(value: number, dailyLimit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(dailyLimit, Math.max(0, Math.round(value)));
}
