/**
 * 暮らし帳とわんカロリー画面で共有する、今開いているデータ。
 * 画面を行き来するときはサーバーへ取り直さず、これを渡す。
 * 日付もこの中の date。タブを閉じると消える。
 */
import type { CalorieState } from "@/lib/calorie/types";

let held: CalorieState | null = null;

/** いま持っている CalorieState。無ければ null。日付は state.date。タブを閉じると消える。取り直す条件を変えるときは、各画面の peek 判定。 */
export function peekCalorieState(): CalorieState | null {
  return held;
}

/** 日付変更や保存のあと、暮らし帳とわんカロリーが同じ内容を見るように残す。引数は画面が返す一式。ここを飛ばすと次の画面が取り直す。 */
export function holdCalorieState(state: CalorieState) {
  held = state;
}
