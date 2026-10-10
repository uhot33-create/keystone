/**
 * お散歩全体の親ルート（/walk）。未ログインなら Protected が止める。
 * カード一覧・新規・編集・散歩ログは、この中の Outlet に出る。
 * 検索や並び、画像サイズ、GPX の切れ目はこのファイルでは変えない。
 * それぞれ lib/walk/filter.ts、lib/walk/image.ts、lib/walk-log/gpx.ts。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

/** ログイン必須のレイアウト。中身は子ルート。 */
export const Route = createFileRoute("/walk")({
  component: WalkLayout,
});

function WalkLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}
