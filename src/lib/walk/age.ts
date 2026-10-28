/**
 * お散歩メモの年齢と日付。
 * カード一覧・新規・編集で「○歳」表示と、今日かどうかの判定に使う。
 * 今日は日本時間（Asia/Tokyo）。タイムゾーンを変えるなら定数 JST。
 * 表示の「歳」は formatAge。満年齢の計算は ageFromBirthday。
 * 未来日を拒否する判定は isFutureDate。入力の上限そのものは api.ts。
 */
/**
 * 今日の判定に使うタイムゾーン。変えると「今日会った」と日付の上限がずれる。
 * 画面は一覧の肉球と、新規・編集の date の max。今日の文字列は todayJst。
 */
const JST = "Asia/Tokyo";

/**
 * 日本時間の今日を YYYY-MM-DD で返す。「今日会った」や日付入力の上限に使う。
 * 画面は一覧の肉球、新規・編集の date の max。タイムゾーンは JST。
 * ロケール en-CA は YYYY-MM-DD を出すため。表示のスラッシュは別関数。
 */
export function todayJst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 生年月日（YYYY-MM-DD）から満年齢。形式が違うときは null。誕生日前なら 1 歳引く。
 * 画面は新規・編集の年齢欄と、一覧の並び。保存時も api.ts の normalize がこれを使う。
 * 数え年に変えるなら、この「誕生日前は引く」を外す。0 歳未満は 0。
 */
export function ageFromBirthday(iso: string, today = todayJst()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return Math.max(0, age);
}

/**
 * 年齢の数値を「○歳」にする。一覧の表示文言はここ。
 * 画面は MemoCard。入力欄の数字そのものはフォームの ageYears。
 * 「歳」を変えるならこのテンプレート。
 */
export function formatAge(years: number | null | undefined): string | null {
  if (years == null || !Number.isFinite(years)) return null;
  return `${Math.max(0, Math.round(years))}歳`;
}

/**
 * 保存済みの年齢を優先し、無ければ誕生日から計算して表示する。
 * 画面は /dogfriend のカード。計算は ageFromBirthday、文言は formatAge。
 * 常に誕生日から出すなら ageYears の優先をやめる。
 */
export function displayAge(memo: { ageYears: number | null; birthday: string | null }): string | null {
  if (memo.ageYears != null) return formatAge(memo.ageYears);
  if (memo.birthday) return formatAge(ageFromBirthday(memo.birthday));
  return null;
}

/**
 * ISO 日付を 2024/01/02 の形にする。形式が違うときは null。月日はゼロ埋めのまま。
 * 一覧カードの「2024/1/2」は memo-card の formatMet（別関数）。ここを変えてもカードは変わらない。
 * 使う画面を確認してから直す。
 */
export function formatJaSlashDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

/**
 * その日付が今日（日本時間）より未来なら true。保存時に未来日を拒否する。
 * 画面は新規・編集。判定は api.ts の normalize と touchWalkMemoMet。今日は todayJst。
 * 文字列比較なので YYYY-MM-DD 以外を渡さない。
 */
export function isFutureDate(iso: string, today = todayJst()): boolean {
  return iso > today;
}
