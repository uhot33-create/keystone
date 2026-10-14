/**
 * おさんぽメモ一覧の控え。戻ったときはこれを出し、保存・削除のあとだけ消す。
 */
import type { DogBreed, WalkMemo } from "@/lib/walk/types";

type HeldWalkList = {
  memos: WalkMemo[];
  breeds: DogBreed[];
  thumbs: boolean;
};

let held: HeldWalkList | null = null;

export function peekWalkList(): HeldWalkList | null {
  return held;
}

export function holdWalkList(next: HeldWalkList) {
  held = next;
}

export function dropWalkList() {
  held = null;
}
