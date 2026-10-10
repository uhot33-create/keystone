/**
 * 通院ページ全体の枠。
 * /vet で始まり、子の一覧・新規・編集が Outlet に入る。
 * Protected でログインしていない人は中に入れない。
 * 一覧の件数や項目の設定はこのファイルにはない。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

/** 通院の親ルート。子画面は Outlet に出る。 */
export const Route = createFileRoute("/vet")({
  component: VetLayout,
});

function VetLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}
