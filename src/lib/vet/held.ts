/**
 * 通院一覧の控え。保存・削除のあとは消して、一覧を開いたときだけ取り直す。
 */
import type { VetVisit } from "@/lib/vet/types";

let held: VetVisit[] | null = null;

export function peekVetVisits(): VetVisit[] | null {
  return held;
}

export function holdVetVisits(next: VetVisit[]) {
  held = next;
}

export function dropVetVisits() {
  held = null;
}
