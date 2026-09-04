import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackMap } from "@/components/walk/track-map";
import { WalkSubnav } from "@/components/walk/walk-subnav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteWalkLog, getWalkLog, type WalkLogDetail } from "@/lib/walk-log/api";
import { formatDuration, formatKm, formatLogWhen } from "@/lib/walk-log/format";

export const Route = createFileRoute("/walk/logs/$id")({
  component: WalkLogDetail,
});

function WalkLogDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState<WalkLogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLog(null);
    setError(null);
    getWalkLog({ data: { id } })
      .then((next) => {
        if (!cancelled) setLog(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onDelete() {
    if (!log || !confirm(`「${log.name}」を削除しますか？`)) return;
    setPending(true);
    try {
      await deleteWalkLog({ data: { id: log.id } });
      const fallback = log.nextId || log.prevId;
      await navigate(fallback ? { to: "/walk/logs/$id", params: { id: fallback } } : { to: "/walk/logs" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
      setPending(false);
    }
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <div>
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">03</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg">{log?.name ?? "散歩ログ"}</h1>
      </div>
      <WalkSubnav current="logs" />
      <Link to="/walk/logs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        ログ一覧へ
      </Link>
      <LogNav prevId={log?.prevId} nextId={log?.nextId} />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!log ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="text-sm text-muted">{formatLogWhen(log.startedAt)}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-fg">{formatKm(log.distanceM)}</p>
            <p className="mt-1 text-sm text-muted">{formatDuration(log.elapsedSec)}</p>
            {log.sourceName ? <p className="mt-2 text-xs text-subtle">{log.sourceName}</p> : null}
          </div>
          <TrackMap encoded={log.summaryPolyline} />
          <LogNav prevId={log.prevId} nextId={log.nextId} />
          <Button type="button" variant="outline" onClick={() => void onDelete()} disabled={pending}>
            このログを削除
          </Button>
        </>
      )}
    </div>
  );
}

function LogNav({ prevId, nextId }: { prevId?: string | null; nextId?: string | null }) {
  return (
    <div className="flex gap-2">
      {prevId ? (
        <Button asChild variant="outline" className="flex-1">
          <Link to="/walk/logs/$id" params={{ id: prevId }}>
            前のログ
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" className="flex-1" disabled>
          前のログ
        </Button>
      )}
      {nextId ? (
        <Button asChild variant="outline" className="flex-1">
          <Link to="/walk/logs/$id" params={{ id: nextId }}>
            次のログ
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" className="flex-1" disabled>
          次のログ
        </Button>
      )}
    </div>
  );
}