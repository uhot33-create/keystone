/**
 * 散歩ログの親ルート（/dogwalklogs）。未ログインなら Protected が止める。
 * 一覧・詳細・月地図はこの中の Outlet に出る。データの取得は子ルート。ここはログインの枠だけ。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

/** ログイン必須の親。中身は子ルート。 */
export const Route = createFileRoute("/dogwalklogs")({
  component: WalkLogsLayout,
});

/** ログイン必須の枠。中身は子ルートの Outlet。 */
function WalkLogsLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}