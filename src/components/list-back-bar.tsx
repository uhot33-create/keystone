/**
 * 画面下に固定する「一覧へ」。スクロールしても押せる。
 */
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function ListBackBar({ to }: { to: "/dogwalklogs" | "/dogfriend" | "/vet" }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface">
      <div className="mx-auto max-w-3xl px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button asChild variant="outline" className="w-full">
          <Link to={to}>一覧へ</Link>
        </Button>
      </div>
    </div>,
    document.body,
  );
}
