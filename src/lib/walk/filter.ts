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

function foldJa(value: string): string {
  return value.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60),
  );
}

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

function compareLastMet(a: string | null, b: string | null, newestFirst: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const left = a.slice(0, 10);
  const right = b.slice(0, 10);
  const cmp = left.localeCompare(right);
  return newestFirst ? -cmp : cmp;
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

export function householdMates(memos: WalkMemo[], memo: WalkMemo): string[] {
  const owner = memo.ownerName?.trim();
  if (!owner) return [];
  return memos
    .filter((row) => row.id !== memo.id && row.ownerName?.trim() === owner)
    .map((row) => row.name);
}
