import { createFileRoute } from "@tanstack/react-router";
import { VisitForm } from "@/components/vet/visit-form";
import type { VisitStatus } from "@/lib/vet/types";

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
