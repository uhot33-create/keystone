/**
 * 散歩ログの親ルート（/dogwalklogs）。未ログインなら Protected が止める。
 * 一覧・詳細・月地図はこの中の Outlet に出る。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

export const Route = createFileRoute("/dogwalklogs")({
  component: WalkLogsLayout,
});

function WalkLogsLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}