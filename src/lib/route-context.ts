/**
 * ルートのログインと机の設定。画面を移るたびに取り直さない。
 * ログインし直すときは dropRouteContext してから invalidate する。
 */
import type { DeskVisibility } from "@/lib/desk/visibility";

type SessionUser = { id: string; email: string | null } | null;

export type HeldRouteContext = {
  sessionUser: SessionUser;
  desk: DeskVisibility | null;
};

let held: HeldRouteContext | null = null;

export function peekRouteContext(): HeldRouteContext | null {
  return held;
}

export function holdRouteContext(next: HeldRouteContext) {
  held = next;
}

export function dropRouteContext() {
  held = null;
}
