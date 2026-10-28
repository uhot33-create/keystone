/**
 * チェックリストのページ。
 * 画面は /checks。人のメニューから開く。ログイン必須。
 * 中身は ChecksApp。雛形と日次削除は lib/checks/api.ts。
 */
import { createFileRoute } from "@tanstack/react-router";
import { ChecksApp } from "@/components/checks/checks-app";
import { Protected } from "@/components/protected";

/**
 * /checks のルート。中身は ChecksPage。
 * パスを変えるときは createFileRoute とこのファイルの場所。
 */
export const Route = createFileRoute("/checks")({ component: ChecksPage });

/**
 * チェックリストのページ本体。
 * Protected でログイン必須。中身は ChecksApp。
 * リストの動きを変えるときは components/checks/checks-app.tsx。
 */
function ChecksPage() {
  return (
    <Protected>
      <ChecksApp />
    </Protected>
  );
}
