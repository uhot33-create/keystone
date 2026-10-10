/**
 * お散歩メモの年齢と日付。
 * カード一覧・新規・編集で「○歳」表示と、今日かどうかの判定に使う。
 * 今日は日本時間（Asia/Tokyo）。タイムゾーンを変えるなら定数 JST。
 * 表示の「歳」は formatAge。満年齢の計算は ageFromBirthday。
 * 未来日を拒否する判定は isFutureDate。入力の上限そのものは api.ts。
 */
const JST = "Asia/Tokyo";

/** 日本時間の今日を YYYY-MM-DD で返す。「今日会った」や日付入力の上限に使う。 */
export function todayJst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 生年月日（YYYY-MM-DD）から満年齢。形式が違うときは null。誕生日前なら 1 歳引く。 */
export function ageFromBirthday(iso: string, today = todayJst()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return Math.max(0, age);
}

/** 年齢の数値を「○歳」にする。一覧と編集の表示文言はここ。 */
export function formatAge(years: number | null | undefined): string | null {
  if (years == null || !Number.isFinite(years)) return null;
  return `${Math.max(0, Math.round(years))}歳`;
}

/** 保存済みの年齢を優先し、無ければ誕生日から計算して表示する。 */
export function displayAge(memo: { ageYears: number | null; birthday: string | null }): string | null {
  if (memo.ageYears != null) return formatAge(memo.ageYears);
  if (memo.birthday) return formatAge(ageFromBirthday(memo.birthday));
  return null;
}

/** ISO 日付を 2024/01/02 の形にする。形式が違うときは null。 */
export function formatJaSlashDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

/** その日付が今日（日本時間）より未来なら true。保存時に未来日を拒否する。 */
export function isFutureDate(iso: string, today = todayJst()): boolean {
  return iso > today;
}
