/**
 * 散歩ログの距離・時間・日時の表示。
 * 画面はログ一覧、ログ詳細、月の合計。
 * km の小数は formatKm（10km 未満は小数 2 桁、以上は 1 桁）。
 * 「時間・分・秒」の言い方は formatDuration。日時は日本時間の formatLogWhen。
 * 地図や GPX の計算はこのファイルでは変えない。
 */

/** メートルを km 表示にする。0 以下は「0 km」。 */
export function formatKm(meters: number): string {
  if (!(meters > 0)) return "0 km";
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
}

/** 秒を「○時間○分」「○分」「○秒」にする。0 は「—」。 */
export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}時間${minutes}分`;
  if (minutes > 0) return `${minutes}分`;
  return total > 0 ? `${total}秒` : "—";
}

/** 開始日時を日本時間で「○月○日（曜）時:分」。無いときは「日時なし」。 */
export function formatLogWhen(iso: string | null): string {
  if (!iso) return "日時なし";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
