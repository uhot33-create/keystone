/**
 * 通院を1件開いて編集する画面。
 * パスは /vet/$id/edit。URL の id で getVetVisit を呼ぶ。
 * 予定なら見出しは「予定を編集」、履歴なら「通院を編集」。
 * 入力そのものは VisitForm。ここは読み込みとエラー表示だけ。
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VisitForm } from "@/components/vet/visit-form";
import { PageHeading } from "@/components/page-heading";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getVetVisit } from "@/lib/vet/api";
import type { VetVisit } from "@/lib/vet/types";

/** このURLの画面定義。中身は VetEdit。 */
export const Route = createFileRoute("/vet/$id/edit")({ component: VetEdit });

function VetEdit() {
  const { id } = Route.useParams();
  const [visit, setVisit] = useState<VetVisit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVetVisit({ data: { id } })
      .then((row) => {
        if (!cancelled) setVisit(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <BusyOverlay show={!visit && !error} label="読み込み中…" />
      <PageHeading title={visit?.status === "planned" ? "予定を編集" : "通院を編集"} />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!visit && !error ? <Skeleton className="h-64 rounded-xl" /> : null}
      {visit ? <VisitForm visit={visit} /> : null}
    </div>
  );
}
