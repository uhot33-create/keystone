import { Link } from "@tanstack/react-router";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

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
