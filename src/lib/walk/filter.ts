import { ageFromBirthday } from "./age";
import type { SortKey, WalkMemo } from "./types";
import { SORT_OPTIONS } from "./types";

export function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((item) => item.value === value);
}

function ageOf(memo: WalkMemo): number | null {
  if (memo.ageYears != null) return memo.ageYears;
  if (memo.birthday) return ageFromBirthday(memo.birthday);
  return null;
}

export function filterMemos(
  memos: WalkMemo[],
  query: { q: string; sort: SortKey; breed: string },
): WalkMemo[] {
  const needle = query.q.trim().toLocaleLowerCase("ja-JP");
  let rows = memos.filter((memo) => {
    if (needle && !memo.name.toLocaleLowerCase("ja-JP").includes(needle)) return false;
    if (query.breed && memo.breedId !== query.breed) return false;
    return true;
  });

  rows = [...rows].sort((a, b) => {
    switch (query.sort) {
      case "name_desc":
        return b.name.localeCompare(a.name, "ja");
      case "last_met_desc":
        return compareNullable(b.lastMetOn, a.lastMetOn);
      case "last_met_asc":
        return compareNullable(a.lastMetOn, b.lastMetOn);
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

function compareNullable(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
}

function compareNullableNum(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
