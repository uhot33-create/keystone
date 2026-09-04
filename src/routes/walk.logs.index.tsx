import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WalkSubnav } from "@/components/walk/walk-subnav";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteWalkLog, getWalkLogs, saveWalkLog, type WalkLog } from "@/lib/walk-log/api";
import { formatDuration, formatKm, formatLogWhen } from "@/lib/walk-log/format";
import { parseGpxFile } from "@/lib/walk-log/gpx";

export const Route = createFileRoute("/walk/logs/")({
  component: WalkLogsPage,
});

function WalkLogsPage() {
  const [logs, setLogs] = useState<WalkLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWalkLogs()
      .then((next) => {
        if (!cancelled) setLogs(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const parsed = await parseGpxFile(file);
      setLogs(await saveWalkLog({ data: parsed }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り込みできませんでした");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    setPending(true);
    try {
      setLogs(await deleteWalkLog({ data: { id } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <div>
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">03</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg">散歩ログ</h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          GPS アプリから書き出した GPX を入れて、距離と軌跡を残します。
        </p>
      </div>
      <WalkSubnav current="logs" />

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <Label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-border bg-primary px-4 text-sm font-medium text-primary-fg shadow-card">
          {pending ? "取り込み中…" : "GPX を取り込む"}
          <input
            type="file"
            accept="*/*,.gpx,.xml,application/gpx+xml,text/xml,application/octet-stream"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              void onPick(event.target.files);
              event.target.value = "";
            }}
          />
        </Label>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Geographica などは「書き出し → GPX → ファイルに保存」してから選んでください。iPhone の一覧に出ないときは、共有シートで「ファイルに保存」したあとに「ブラウズ」から探します。8MB 以下。
        </p>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!logs ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted">まだログがありません。GPX を取り込んでください。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => (
            <li key={log.id} className="flex items-stretch gap-2">
              <Link
                to="/walk/logs/$id"
                params={{ id: log.id }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold text-fg">{log.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{formatLogWhen(log.startedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-sm text-fg">{formatKm(log.distanceM)}</p>
                  <p className="text-xs text-subtle">{formatDuration(log.elapsedSec)}</p>
                </div>
              </Link>
              <Button
                type="button"
                variant="outline"
                className="self-center"
                disabled={pending}
                onClick={() => void onDelete(log.id, log.name)}
              >
                削除
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
