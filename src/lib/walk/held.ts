/**
 * おさんぽメモ一覧の控え。ブラウザのメモリだけ（DB ではない）。
 * 画面は /dogfriend。戻ったときは peek の内容を出し、保存・削除のあとだけ drop する。
 * 中身は WalkMemo と DogBreed（walk/types.ts）。サムネ済みかどうかも thumbs に持つ。
 * 消すタイミングを変えるなら memo-form の dropWalkList。一覧の再取得条件はルート側。
 */
import type { DogBreed, WalkMemo } from "@/lib/walk/types";

/**
 * 一覧の控え。memos と犬種、サムネを足し終えたか。ブラウザのメモリだけ。
 * 画面は /dogfriend。DB ではない。捨てるのは dropWalkList。
 */
type HeldWalkList = {
  memos: WalkMemo[];
  breeds: DogBreed[];
  thumbs: boolean;
};

let held: HeldWalkList | null = null;

/**
 * 控えが無ければ null。画面を開いた瞬間、通信の前に出す。
 * 画面は /dogfriend。中身はブラウザのメモリだけ（DB ではない）。
 * 保存・削除で drop したあとは null になり、次の一覧で取り直す。
 */
export function peekWalkList(): HeldWalkList | null {
  return held;
}

/**
 * 取得済みの一覧を上書きする。ログインユーザーをまたがない（画面を離れると消える前提）。
 * 画面は /dogfriend。サムネを足したあとも thumbs: true で上書きする。
 * 肉球や戻す操作も、再取得せずこの控えを書き換える。
 */
export function holdWalkList(next: HeldWalkList) {
  held = next;
}

/**
 * 控えを捨てる。保存・削除のあと、次の一覧で取り直すために呼ぶ。
 * 画面は新規・編集（memo-form）。呼ぶまで /dogfriend は peek のまま再取得しない。
 * 一覧の肉球更新は drop せず hold で上書きする。戻す（restore）もフォーム側はここを呼ぶ。
 */
export function dropWalkList() {
  held = null;
}
