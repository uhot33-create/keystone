/**
 * 通院の新規画面。
 * パスは /vet/new。?as=done のとき履歴、それ以外（as=planned を含む）は予定。
 * 一覧の「予定」「記録」ボタンがこの検索パラメータを付ける。
 * フォーム本体は VisitForm。説明文だけここで切り替えている。
 */
import { createFileRoute } from "@tanstack/react-router";
import { VisitForm } from "@/components/vet/visit-form";
import type { VisitStatus } from "@/lib/vet/types";

/** 検索 as を planned か done だけ通す。それ以外は未指定。 */
export const Route = createFileRoute("/vet/new")({
  validateSearch: (search: Record<string, unknown>): { as?: VisitStatus } => ({
    as: search.as === "planned" || search.as === "done" ? search.as : undefined,
  }),
  component: VetNew,
});

function VetNew() {
  const { as } = Route.useSearch();
  const planned = as !== "done";
  return (
    <div className="stagger-in flex flex-1 flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-fg">{planned ? "予定を追加" : "通院を追加"}</h1>
        <p className="mt-1 text-sm text-muted">
          {planned ? "行ったらこの予定を開いて、履歴にできます。" : "日付と目的だけでも残せます。"}
        </p>
      </div>
      <VisitForm initialStatus={planned ? "planned" : "done"} />
    </div>
  );
}
