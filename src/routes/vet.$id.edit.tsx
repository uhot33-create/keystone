import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VisitForm } from "@/components/vet/visit-form";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getVetVisit } from "@/lib/vet/api";
import type { VetVisit } from "@/lib/vet/types";

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
    <div className="stagger-in flex flex-1 flex-col gap-5">
      <BusyOverlay show={!visit && !error} label="読み込み中…" />
      <div>
        <h1 className="font-display text-3xl font-semibold text-fg">通院を編集</h1>
      </div>
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
