/**
 * 散歩ログの 1 件（/dogwalklogs/$id）。
 * 距離・時間・軌跡と、前後のログへの移動。削除は deleteWalkLog。
 * 地図は TrackMap。線の切れ目は gpx.ts の TRACK_GAP_M。
 * 表示の km と時間は format.ts。名前は取り込み時の町名か GPX 名。
 */
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackMap } from "@/components/walk/track-map";
import { ListBackBar } from "@/components/list-back-bar";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteWalkLog, getWalkLog, type WalkLogDetail, type WalkLogList } from "@/lib/walk-log/api";
import { dropWalkLogs, peekWalkLogs } from "@/lib/walk-log/held";
import { formatDuration, formatKm, formatLogWhen } from "@/lib/walk-log/format";

/** 詳細ルート。id は URL。前後は getWalkLog の prevId / nextId。 */
export const Route = createFileRoute("/dogwalklogs/$id")({
  component: WalkLogDetail,
});

/** URL の id の1件。一覧キャッシュで先に出し、getWalkLog で軌跡を足す。 */
function WalkLogDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState<WalkLogDetail | null>(() => detailFromList(peekWalkLogs(), id));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** id が変わるたびに詳細を取り直す。一覧にあれば距離と名前だけ先に出す。軌跡は getWalkLog。 */
  useEffect(() => {
    const cached = detailFromList(peekWalkLogs(), id);
    if (cached) setLog(cached);
    else {
      setLog(null);
      setError(null);
    }
    let cancelled = false;
    getWalkLog({ data: { id } })
      .then((next) => {
        if (!cancelled) setLog(next);
      })
      .catch((err: unknown) => {
        if (!cancelled && !cached) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** 確認のあと削除し、一覧キャッシュを捨てる。前後があればその詳細、無ければ一覧へ戻る。 */
  async function onDelete() {
    if (!log || !confirm(`「${log.name}」を削除しますか？`)) return;
    setPending(true);
    try {
      await deleteWalkLog({ data: { id: log.id } });
      dropWalkLogs();
      const fallback = log.nextId || log.prevId;
      await navigate(fallback ? { to: "/dogwalklogs/$id", params: { id: fallback } } : { to: "/dogwalklogs" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
      setPending(false);
    }
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4 pb-24">
      <BusyOverlay show={pending || !log} label={pending ? "処理中…" : "読み込み中…"} />
      <PageHeading title={log?.name ?? "おさんぽログ"} />
      <ListBackBar to="/dogwalklogs" />
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

/** 一覧キャッシュから仮の詳細を作る。前後の id は並び順。軌跡はまだ無い。 */
function detailFromList(list: WalkLogList | null, id: string): WalkLogDetail | null {
  if (!list) return null;
  const flat = [...list.years.flatMap((year) => year.months.flatMap((month) => month.logs)), ...list.undated];
  const index = flat.findIndex((item) => item.id === id);
  const log = flat[index];
  if (!log) return null;
  return { ...log, prevId: flat[index - 1]?.id ?? null, nextId: flat[index + 1]?.id ?? null };
}

/** 前後のログへ id を渡す。端ではボタンを止める。並びの規則は getWalkLog。 */
function LogNav({ prevId, nextId }: { prevId?: string | null; nextId?: string | null }) {
  return (
    <div className="flex gap-2">
      {prevId ? (
        <Button asChild variant="outline" className="flex-1">
          <Link to="/dogwalklogs/$id" params={{ id: prevId }}>
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
          <Link to="/dogwalklogs/$id" params={{ id: nextId }}>
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