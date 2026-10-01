import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackMap } from "@/components/walk/track-map";
import { WalkSubnav } from "@/components/walk/walk-subnav";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkMonth, type WalkMonthTrack } from "@/lib/walk-log/api";
import { formatDuration, formatKm } from "@/lib/walk-log/format";

export const Route = createFileRoute("/walk/logs/month/$yearMonth")({
  component: WalkMonthPage,
});

function WalkMonthPage() {
  const { yearMonth } = Route.useParams();
  const [month, setMonth] = useState<WalkMonthTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMonth(null);
    setError(null);
    getWalkMonth({ data: { yearMonth } })
      .then((next) => {
        if (!cancelled) setMonth(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [yearMonth]);

  const label = monthLabel(yearMonth);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <BusyOverlay show={!month && !error} label="読み込み中…" />
      <div>
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">03</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg">{label}</h1>
      </div>
      <WalkSubnav current="logs" />
      <Link to="/walk/logs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        ログ一覧へ
      </Link>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!month ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="text-sm text-muted">{month.logCount}件の合計</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-fg">{formatKm(month.distanceM)}</p>
            <p className="mt-1 text-sm text-muted">{formatDuration(month.elapsedSec)}</p>
            <p className="mt-3 text-xs leading-relaxed text-subtle">
              中心が同じ5km四方の散歩だけを同じ地図に重ねています。離れた場所は別の地図です。前後の散歩は線でつなぎません。
            </p>
          </div>
          {month.regions.length > 0 ? (
            month.regions.map((region) => (
              <section key={region.label} className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-fg">{region.label}</h2>
                  <p className="text-right text-sm text-muted">
                    <span className="tabular-nums text-fg">{formatKm(region.distanceM)}</span>
                    <span className="mt-0.5 block text-xs">{formatDuration(region.elapsedSec)}</span>
                  </p>
                </div>
                <TrackMap tracks={region.polylines} />
              </section>
            ))
          ) : (
            <TrackMap tracks={month.polylines} />
          )}
        </>
      )}
    </div>
  );
}

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  if (!year || !month) return "月の合計";
  return `${year}年${Number(month)}月の合計`;
}
