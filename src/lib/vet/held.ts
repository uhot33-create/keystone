/**
 * 通院一覧の控え。ブラウザのメモリだけ。
 * 画面は /vet。保存・削除のあとは drop し、一覧を開いたときだけ listVetVisits で取り直す。
 * テーブルは vet_visits。先生メモ（vet_doctor_memo）はこの控えに含めない。
 * 日付の並びは API 側（新しい順）。ここは配列を持つだけ。
 */
import type { VetVisit } from "@/lib/vet/types";

let held: VetVisit[] | null = null;

/** 控えが無ければ null。 */
export function peekVetVisits(): VetVisit[] | null {
  return held;
}

/** 取得した一覧で上書きする。自分の user_id の行だけが入っている前提。 */
export function holdVetVisits(next: VetVisit[]) {
  held = next;
}

/** 控えを捨てる。saveVetVisit / deleteVetVisit の成功後に呼ぶ。 */
export function dropVetVisits() {
  held = null;
}
