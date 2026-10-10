/**
 * 画面遷移のルーターを作る。経路の一覧は routeTree.gen.ts（自動生成。編集しない）。
 * 落ちたときの画面は lib/error-component.tsx。待ちの最小時間は 0（すぐ出す）。
 */
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

/** アプリ全体で使うルーター。 */
export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
}
