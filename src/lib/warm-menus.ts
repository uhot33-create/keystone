/**
 * 暮らし帳を出したあと、メニュー先の画面を裏で読む。
 * タップしたときは、ここが残した内容をすぐ出す。一度だけ。
 */
import type { AnyRouter } from "@tanstack/router-core";
import { getCupState } from "@/lib/cup/api";
import { holdCup, peekCup } from "@/lib/cup/held";
import { getSmokingBadges, getSmokingState } from "@/lib/smoking/api";
import { holdSmoking, peekSmoking } from "@/lib/smoking/held";
import { listVetVisits } from "@/lib/vet/api";
import { holdVetVisits, peekVetVisits } from "@/lib/vet/held";
import { getWalkLogs } from "@/lib/walk-log/api";
import { holdWalkLogs, peekWalkLogs } from "@/lib/walk-log/held";
import { getWalkState, getWalkThumbs } from "@/lib/walk/api";
import { holdWalkList, peekWalkList } from "@/lib/walk/held";
import { applyWalkThumbs } from "@/lib/walk/thumbs";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

let started = false;

/** 画面の部品とデータを先に取る。失敗してもメニューはそのまま。 */
export function warmMenus(router: AnyRouter) {
  if (started || typeof window === "undefined") return;
  started = true;
  void router.preloadRoute({ to: "/calorie" }).catch(() => undefined);
  void router.preloadRoute({ to: "/calorie-batch" }).catch(() => undefined);
  void router.preloadRoute({ to: "/dogfriend", search: DEFAULT_WALK_SEARCH }).catch(() => undefined);
  void router.preloadRoute({ to: "/dogwalklogs" }).catch(() => undefined);
  void router.preloadRoute({ to: "/vet" }).catch(() => undefined);
  void router.preloadRoute({ to: "/smoking" }).catch(() => undefined);
  void router.preloadRoute({ to: "/cup" }).catch(() => undefined);
  void warmData();
}

async function warmData() {
  await Promise.all([warmWalk(), warmLogs(), warmVet(), warmSmoke(), warmCup()]);
}

async function warmWalk() {
  if (peekWalkList()?.thumbs) return;
  try {
    if (!peekWalkList()) {
      const state = await getWalkState();
      holdWalkList({ memos: state.memos, breeds: state.breeds, thumbs: false });
    }
    const current = peekWalkList();
    if (!current || current.thumbs) return;
    const memos = applyWalkThumbs(current.memos, await getWalkThumbs());
    holdWalkList({ memos, breeds: current.breeds, thumbs: true });
  } catch {
    /* 開いたときに取る */
  }
}

async function warmLogs() {
  if (peekWalkLogs()) return;
  try {
    holdWalkLogs(await getWalkLogs());
  } catch {
    /* 開いたときに取る */
  }
}

async function warmVet() {
  if (peekVetVisits()) return;
  try {
    holdVetVisits(await listVetVisits());
  } catch {
    /* 開いたときに取る */
  }
}

async function warmSmoke() {
  if (peekSmoking()) return;
  try {
    const [state, badges] = await Promise.all([getSmokingState(), getSmokingBadges()]);
    holdSmoking({ ...state, badges }, true);
  } catch {
    /* 開いたときに取る */
  }
}

async function warmCup() {
  if (peekCup()) return;
  try {
    holdCup(await getCupState());
  } catch {
    /* 開いたときに取る */
  }
}
