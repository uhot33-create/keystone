/**
 * 散歩ログの一覧（/dogwalklogs）。年・月でたたんで、距離のバーを出す。
 * GPX の取り込みは parseGpxFile のあと saveWalkLog。上限 8MB は gpx.ts。
 * 月の「地図」リンクは /dogwalklogs/month/$yearMonth。集計は毎日 0 時。
 * 最初に開く年・月は日本時間の今年・今月。
 * 距離の小数や時間表記は format.ts。
 */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkLogs, saveWalkLog, type WalkLog, type WalkLogList, type WalkMonthSummary } from "@/lib/walk-log/api";
import { holdWalkLogs, peekWalkLogs } from "@/lib/walk-log/held";
import { formatDuration, formatKm } from "@/lib/walk-log/format";
import { parseGpxFile } from "@/lib/walk-log/gpx";

/** ログ一覧ルート。データは getWalkLogs（軌跡の中身は含まない）。 */
export const Route = createFileRoute("/dogwalklogs/")({
  component: WalkLogsPage,
});

/** 年・月でたたんだ一覧。キャッシュが無ければ getWalkLogs。軌跡の中身は詳細側。 */
function WalkLogsPage() {
  const [logs, setLogs] = useState<WalkLogList | null>(() => peekWalkLogs());
  const [openYears, setOpenYears] = useState<number[]>(() => [jstYear()]);
  const [openMonths, setOpenMonths] = useState<string[]>(() => [jstYearMonth()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showTop, setShowTop] = useState(false);

  /** 240px より下で TOP を出す。ログの取得とは別。 */
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** キャッシュが無ければ一覧を取る。開く年・月の初期値は日本時間の今年・今月（jstYear / jstYearMonth）。 */
  useEffect(() => {
    if (peekWalkLogs()) return;
    let cancelled = false;
    getWalkLogs()
      .then((next) => {
        if (cancelled) return;
        holdWalkLogs(next);
        setLogs(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * GPX を parseGpxFile で読んで saveWalkLog する。画面は /dogwalklogs。
   * 8MB 超は gpx.ts の MAX_GPX_BYTES が落とす。上限を変えるときはそちら。
   * 取り込みでは月の軌跡まとめ（walk_month_tracks）は作り直さない。
   */
  async function onPick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const parsed = await parseGpxFile(file);
      const saved = await saveWalkLog({ data: parsed });
      holdWalkLogs(saved);
      setLogs(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り込みできませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <BusyOverlay show={pending || logs === null} label={pending ? "処理中…" : "読み込み中…"} />
      <PageHeading title="おさんぽログ" />

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

/** 日本時間の西暦。最初に開く年。タイムゾーンを変えると「今年」がずれる。 */
function jstYear(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date()));
}

/** 日本時間の YYYY-MM。最初に開く月。月の地図リンクの形と揃える。 */
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

/** 1か月分。開くとその月のログ。地図へは yearMonth をそのまま渡す。 */
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
          to="/dogwalklogs/month/$yearMonth"
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

/** 同じグループ内の最大距離に対する棒。距離0は幅0。比率の下限は 6%。 */
function DistanceBar({ value, max, className = "min-w-8 flex-1" }: { value: number; max: number; className?: string }) {
  const width = max > 0 && value > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <span className={`block h-2 overflow-hidden rounded-full bg-surface-2 ${className}`} aria-hidden="true">
      <span className="block h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </span>
  );
}

/** 開始時刻を日本時間の「D日 HH:MM」にする。時刻が無ければ「日時なし」。 */
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

/** 1件の行。詳細へ id を渡す。km と時間の表記は format.ts。 */
function LogRow({ log, maxDistance }: { log: WalkLog; maxDistance: number }) {
  return (
    <li>
      <Link
        to="/dogwalklogs/$id"
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
