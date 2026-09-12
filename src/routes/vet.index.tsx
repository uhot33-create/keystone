import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatJaDate } from "@/lib/calorie/formula";
import { listVetVisits } from "@/lib/vet/api";
import type { VetVisit } from "@/lib/vet/types";
import { todayJst } from "@/lib/walk/age";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/vet/")({ component: VetIndex });

function VetIndex() {
  const [visits, setVisits] = useState<VetVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayJst();

  useEffect(() => {
    let cancelled = false;
    listVetVisits()
      .then((rows) => {
        if (!cancelled) setVisits(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => {
    if (!visits) return [];
    return visits
      .filter((item) => item.nextVisitOn && item.nextVisitOn >= today)
      .sort((a, b) => (a.nextVisitOn ?? "").localeCompare(b.nextVisitOn ?? ""));
  }, [visits, today]);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-5">
      <BusyOverlay show={visits === null} label="読み込み中…" />
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-fg">通院履歴</h1>
          <p className="mt-1 text-sm text-muted">病院での記録と、次の予約を残します。</p>
        </div>
        <Button asChild>
          <Link to="/vet/new">追加</Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
          <p className="text-xs font-medium tracking-widest text-subtle">次の予約</p>
          <ul className="mt-2 space-y-1.5">
            {upcoming.slice(0, 3).map((item) => (
              <li key={item.id} className="text-sm text-fg">
                {item.nextVisitOn ? formatJaDate(item.nextVisitOn) : ""}
                <span className="ml-2 text-muted">{item.clinicName || item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!visits ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : visits.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-8 shadow-card">
          <p className="font-display text-lg font-semibold text-fg">まだ記録がありません</p>
          <p className="mt-2 text-sm text-muted">ワクチンや健診、病気のときの通院を残してください。</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((visit) => (
            <li key={visit.id}>
              <Link
                to="/vet/$id/edit"
                params={{ id: visit.id }}
                className="block rounded-xl border border-border bg-surface px-4 py-3 shadow-card outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg">{formatJaDate(visit.visitOn)}</p>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{visit.kind}</span>
                </div>
                <p className="mt-1 truncate font-display text-base font-semibold text-fg">{visit.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {visit.clinicName || "病院未記入"}
                  {visit.nextVisitOn ? `　次回 ${formatJaDate(visit.nextVisitOn)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
