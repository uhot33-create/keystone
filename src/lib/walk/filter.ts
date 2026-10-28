/**
 * お散歩カード一覧の検索・並び・多頭飼いのつながり。
 * 画面は /dogfriend。ツールバー（MemoToolbar）の条件をここで絞り込む。
 * 検索対象を変えるなら filterMemos の hay（名前・飼い主・メモ・犬種・色）。
 * 並びの種類を増やすなら types.ts の SORT_OPTIONS と、ここの switch。
 * ひらがなとカタカナは同じ文字として探す（foldJa）。
 */
import { ageFromBirthday } from "./age";
import type { SortKey, WalkMemo } from "./types";
import { SORT_OPTIONS } from "./types";

/** URL の sort が SORT_OPTIONS にある値か。無いときは一覧側が名前昇順に戻す。 */
export function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((item) => item.value === value);
}

/** 並び用の年齢。保存値があればそれ、無ければ誕生日から満年齢。誕生日も無ければ末尾に寄せる。 */
function ageOf(memo: WalkMemo): number | null {
  if (memo.ageYears != null) return memo.ageYears;
  if (memo.birthday) return ageFromBirthday(memo.birthday);
  return null;
}

/** ひらがなをカタカナに寄せる。検索で「しば」と「シバ」を同じにする。範囲を変えるならこの正規表現。 */
function foldJa(value: string): string {
  return value.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60),
  );
}

/** 検索語・犬種・並び順で一覧を返す。検索は名前・飼い主・メモ・犬種名・色名。 */
export function filterMemos(
  memos: WalkMemo[],
  query: { q: string; sort: SortKey; breed: string },
): WalkMemo[] {
  const needle = foldJa(query.q.trim().toLocaleLowerCase("ja-JP"));
  let rows = memos.filter((memo) => {
    if (needle) {
      const hay = foldJa(
        [memo.name, memo.ownerName, memo.note, memo.breedName, memo.colorName]
          .filter(Boolean)
          .join("\n")
          .toLocaleLowerCase("ja-JP"),
      );
      if (!hay.includes(needle)) return false;
    }
    if (query.breed && memo.breedId !== query.breed) return false;
    return true;
  });

  rows = [...rows].sort((a, b) => {
    switch (query.sort) {
      case "name_desc":
        return b.name.localeCompare(a.name, "ja");
      case "last_met_desc":
        return compareLastMet(a.lastMetOn, b.lastMetOn, true);
      case "last_met_asc":
        return compareLastMet(a.lastMetOn, b.lastMetOn, false);
      case "created_desc":
        return b.createdAt.localeCompare(a.createdAt);
      case "age_desc":
        return compareNullableNum(ageOf(b), ageOf(a));
      case "age_asc":
        return compareNullableNum(ageOf(a), ageOf(b));
      case "name_asc":
      default:
        return a.name.localeCompare(b.name, "ja");
    }
  });

  return rows;
}

/** 最後に会った日の比較。日付が無いカードは常に後ろ。newestFirst なら新しい日が先。日付は先頭10文字（YYYY-MM-DD）。 */
function compareLastMet(a: string | null, b: string | null, newestFirst: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const left = a.slice(0, 10);
  const right = b.slice(0, 10);
  const cmp = left.localeCompare(right);
  return newestFirst ? -cmp : cmp;
}

/** 文字列の null は後ろ。今は並びの switch からは使っていない。 */
function compareNullable(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
}

/** 数値の null は後ろ（年齢が空のカードを下にする）。 */
function compareNullableNum(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

/** 同じ飼い主名のほかの犬。カードの「ほか」表示。表記が違うとつながらない。 */
export function householdMates(memos: WalkMemo[], memo: WalkMemo): string[] {
  const owner = memo.ownerName?.trim();
  if (!owner) return [];
  return memos
    .filter((row) => row.id !== memo.id && row.ownerName?.trim() === owner)
    .map((row) => row.name);
}

/**
 * 同じ飼い主で、まだ metOn になっていない生きている犬。今日会った・編集保存の確認に使う。
 * 飼い主名は trim した完全一致。虹渡り（rainbowBridge）は聞かない。すでにその日付の犬も除外する。
 * 確認ダイアログの対象を変えるならここの filter。画面は memo-form の answerFollow と一覧の肉球。
 */
export function householdOthers(memos: WalkMemo[], memo: WalkMemo, metOn: string): WalkMemo[] {
  const owner = memo.ownerName?.trim();
  if (!owner) return [];
  return memos
    .filter(
      (row) =>
        row.id !== memo.id &&
        row.ownerName?.trim() === owner &&
        !row.rainbowBridge &&
        row.lastMetOn !== metOn,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
