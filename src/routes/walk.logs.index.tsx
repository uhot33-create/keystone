import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WalkSubnav } from "@/components/walk/walk-subnav";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkLogs, saveWalkLog, type WalkLog, type WalkLogList, type WalkMonthSummary } from "@/lib/walk-log/api";
import { formatDuration, formatKm } from "@/lib/walk-log/format";
import { parseGpxFile } from "@/lib/walk-log/gpx";

export const Route = createFileRoute("/walk/logs/")({
  component: WalkLogsPage,
});

function WalkLogsPage() {
  const [logs, setLogs] = useState<WalkLogList | null>(null);
  const [openYears, setOpenYears] = useState<number[]>(() => [jstYear()]);
  const [openMonths, setOpenMonths] = useState<string[]>(() => [jstYearMonth()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <BusyOverlay show={pending || logs === null} label={pending ? "処理中…" : "読み込み中…"} />
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
            accept=".gpx,.xml,text/xml,application/xml,application/octet-stream"
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
      ) : logs.years.length === 0 && logs.undated.length === 0 ? (
        <p className="text-sm text-muted">まだログがありません。GPX を取り込んでください。</p>
      ) : (
        <div className="flex flex-col gap-6">
          {logs.years.map((year) => {
            const open = openYears.includes(year.year);
            return (
              <section key={year.year}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenYears((current) =>
                      current.includes(year.year) ? current.filter((item) => item !== year.year) : [...current, year.year],
                    )
                  }
                  className="flex w-full items-baseline justify-between gap-3 py-1 text-left"
                >
                  <h2 className="font-display text-lg font-semibold text-fg">{year.year}年</h2>
                  <span className="text-xs font-medium text-muted">{open ? "閉じる" : "開く"}</span>
                </button>
                {open ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {year.months.map((month) => (
                      <MonthBlock
                        key={month.yearMonth}
                        month={month}
                        maxDistance={Math.max(...year.months.map((item) => item.distanceM), 0)}
                        open={openMonths.includes(month.yearMonth)}
                        onToggle={() =>
                          setOpenMonths((current) =>
                            current.includes(month.yearMonth)
                              ? current.filter((item) => item !== month.yearMonth)
                              : [...current, month.yearMonth],
                          )
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
          {logs.undated.length > 0 ? (
            <section>
              <h2 className="font-display text-lg font-semibold text-fg">日時なし</h2>
              <ul className="mt-2 flex flex-col">
                {logs.undated.map((log) => (
                  <LogRow key={log.id} log={log} maxDistance={Math.max(...logs.undated.map((item) => item.distanceM), 0)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      {showTop ? (
        <button
          type="button"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-fg shadow-card"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          TOP
        </button>
      ) : null}
    </div>
  );
}

function jstYear(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date()));
}

function jstYearMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function MonthBlock({
  month,
  maxDistance,
  open,
  onToggle,
}: {
  month: WalkMonthSummary;
  maxDistance: number;
  open: boolean;
  onToggle: () => void;
}) {
  const dayMax = Math.max(...month.logs.map((log) => log.distanceM), 0);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="flex items-center gap-2 bg-primary/15 px-3 py-2">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="shrink-0 font-display text-sm font-semibold text-fg">{month.month}月</span>
          <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted">{formatDuration(month.elapsedSec)}</span>
          <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-fg">{formatKm(month.distanceM)}</span>
          <DistanceBar value={month.distanceM} max={maxDistance} />
        </button>
        <Link
          to="/walk/logs/month/$yearMonth"
          params={{ yearMonth: month.yearMonth }}
          className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          地図
        </Link>
      </div>
      {open ? (
        <ul className="mt-2 border-t border-border px-3 pt-1">
          {month.logs.map((log) => (
            <LogRow key={log.id} log={log} maxDistance={dayMax} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DistanceBar({ value, max, className = "min-w-8 flex-1" }: { value: number; max: number; className?: string }) {
  const width = max > 0 && value > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <span className={`block h-2 overflow-hidden rounded-full bg-surface-2 ${className}`} aria-hidden="true">
      <span className="block h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </span>
  );
}

function formatDayTime(iso: string | null): string {
  if (!iso) return "日時なし";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "日時なし";
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!day || !hour || !minute) return "日時なし";
  return `${day}日 ${hour}:${minute}`;
}

function LogRow({ log, maxDistance }: { log: WalkLog; maxDistance: number }) {
  return (
    <li>
      <Link
        to="/walk/logs/$id"
        params={{ id: log.id }}
        className="block py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
      >
        <span className="grid grid-cols-[5.75rem_5.5rem_4.5rem_minmax(0,1fr)] items-center gap-x-2">
          <span className="whitespace-nowrap text-xs tabular-nums text-fg">{formatDayTime(log.startedAt)}</span>
          <span className="whitespace-nowrap text-right text-xs tabular-nums text-muted">{formatDuration(log.elapsedSec)}</span>
          <span className="whitespace-nowrap text-right text-xs tabular-nums text-fg">{formatKm(log.distanceM)}</span>
          <DistanceBar value={log.distanceM} max={maxDistance} className="w-full" />
        </span>
        <span className="mt-0.5 block truncate text-sm text-fg">{log.name}</span>
      </Link>
    </li>
  );
}
