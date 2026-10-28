/**
 * おさんぽメモ一覧の控え。ブラウザのメモリだけ（DB ではない）。
 * 画面は /dogfriend。戻ったときは peek の内容を出し、保存・削除のあとだけ drop する。
 * 中身は WalkMemo と DogBreed（walk/types.ts）。サムネ済みかどうかも thumbs に持つ。
 * 消すタイミングを変えるなら memo-form の dropWalkList。一覧の再取得条件はルート側。
 */
import type { DogBreed, WalkMemo } from "@/lib/walk/types";

type HeldWalkList = {
  memos: WalkMemo[];
  breeds: DogBreed[];
  thumbs: boolean;
};

let held: HeldWalkList | null = null;

/** 控えが無ければ null。画面を開いた瞬間、通信の前に出す。 */
export function peekWalkList(): HeldWalkList | null {
  return held;
}

/** 取得済みの一覧を上書きする。ログインユーザーをまたがない（画面を離れると消える前提）。 */
export function holdWalkList(next: HeldWalkList) {
  held = next;
}

/** 控えを捨てる。保存・削除のあと、次の一覧で取り直すために呼ぶ。 */
export function dropWalkList() {
  held = null;
}
