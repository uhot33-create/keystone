/**
 * お散歩メモの親ルート（/dogfriend）。未ログインなら Protected が止める。
 * カード一覧・新規・編集は、この中の Outlet に出る。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

/**
 * お散歩メモの親ルート。子は Outlet に出る。
 * パスは /dogfriend。認証は WalkLayout の Protected。
 * 子を足すなら routes 配下のファイル。この component は枠だけ。
 */
export const Route = createFileRoute("/dogfriend")({
  component: WalkLayout,
});

/**
 * 子ルートを Protected で包むだけ。一覧の取得は dogfriend.index.tsx。
 * 画面は /dogfriend 以下。未ログインは Protected が止める。
 * 検索やカードの中身は子ルート。ここは Outlet だけ。
 */
function WalkLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}
