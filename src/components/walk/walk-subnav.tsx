/**
 * お散歩の「カード」と「散歩ログ」の切り替え。
 * カードは /walk（検索は DEFAULT_WALK_SEARCH に戻る）。ログは /walk/logs。
 * どちらを強調するかは current。タブの見た目もここ。
 * 一覧や地図の中身はこのコンポーネントの外。
 */
import { Link } from "@tanstack/react-router";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

/** 2 タブ。current が "cards" か "logs" で選択中を決める。 */
export function WalkSubnav({ current }: { current: "cards" | "logs" }) {
  const tab = (active: boolean) =>
    [
      "flex h-11 flex-1 items-center justify-center rounded-sm text-sm font-medium",
      active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
    ].join(" ");

  return (
    <div className="grid grid-cols-2 rounded-md bg-surface-2 p-1">
      <Link to="/walk" search={DEFAULT_WALK_SEARCH} className={tab(current === "cards")}>
        カード
      </Link>
      <Link to="/walk/logs" className={tab(current === "logs")}>
        散歩ログ
      </Link>
    </div>
  );
}
