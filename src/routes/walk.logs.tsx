/**
 * 散歩ログの親ルート（/walk/logs）。中身は子ルートの Outlet だけ。
 * 一覧・詳細・月地図の共通の入れ物。ログイン確認は親の /walk。
 * 画面の見出しや GPX ボタンは子の walk.logs.index.tsx。
 * ここを変えても一覧の並びや地図の切れ目は変わらない。
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";

/** ログ配下のレイアウト。描画は子ルートに任せる。 */
export const Route = createFileRoute("/walk/logs")({
  component: () => <Outlet />,
});
