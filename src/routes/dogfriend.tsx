/**
 * お散歩メモの親ルート（/dogfriend）。未ログインなら Protected が止める。
 * カード一覧・新規・編集は、この中の Outlet に出る。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

/** ログイン必須のレイアウト。中身は子ルート。 */
export const Route = createFileRoute("/dogfriend")({
  component: WalkLayout,
});

function WalkLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}
