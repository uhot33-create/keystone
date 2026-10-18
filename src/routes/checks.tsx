/**
 * チェックリストのページ。
 * 画面は /checks。人のメニューから開く。ログイン必須。
 * 中身は ChecksApp。雛形と日次削除は lib/checks/api.ts。
 */
import { createFileRoute } from "@tanstack/react-router";
import { ChecksApp } from "@/components/checks/checks-app";
import { Protected } from "@/components/protected";

/** チェックリストルート。 */
export const Route = createFileRoute("/checks")({ component: ChecksPage });

function ChecksPage() {
  return (
    <Protected>
      <ChecksApp />
    </Protected>
  );
}
