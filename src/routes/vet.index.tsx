import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatJaDate } from "@/lib/calorie/formula";
import { listVetVisits } from "@/lib/vet/api";
import { NEXT_VISIT_STATUS_LABEL, type VetVisit } from "@/lib/vet/types";
import { todayJst } from "@/lib/walk/age";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { DoctorMemoCard } from "@/components/vet/doctor-memo";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/vet/")({ component: VetIndex });

function VetIndex() {
  const [visits, setVisits] = useState<VetVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openYears, setOpenYears] = useState<string[]>(() => [todayJst().slice(0, 4)]);
  const [showTop, setShowTop] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
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
      .filter((item) => item.status === "planned")
      .sort((a, b) => a.visitOn.localeCompare(b.visitOn));
  }, [visits]);

  const history = useMemo(() => {
    if (!visits) return [];
    return visits.filter((item) => item.status !== "planned");
  }, [visits]);

  const hasMore = shown < history.length;

  const historyByYear = useMemo(() => {
    const groups: { year: string; items: VetVisit[] }[] = [];
    for (const visit of history.slice(0, shown)) {
      const year = visit.visitOn.slice(0, 4);
      const last = groups[groups.length - 1];
      if (last?.year === year) last.items.push(visit);
      else groups.push({ year, items: [visit] });
    }
    return groups;
  }, [history, shown]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShown((count) => count + PAGE_SIZE);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, shown]);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-5">
      <BusyOverlay show={visits === null} label="読み込み中…" />
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-fg">通院履歴</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline">
            <Link to="/vet/new" search={{ as: "planned" }}>
              予定
            </Link>
          </Button>
          <Button asChild>
            <Link to="/vet/new" search={{ as: "done" }}>
              記録
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <DoctorMemoCard />

      {upcoming.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
          <p className="text-xs font-medium tracking-widest text-subtle">次の予約</p>
          <ul className="mt-2 space-y-2">
            {upcoming.map((item) => (
              <li key={item.id}>
                <Link
                  to="/vet/$id/edit"
                  params={{ id: item.id }}
                  className="block outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  <p className="text-sm text-fg">
                    {formatJaDate(item.visitOn)}
                    {item.visitTime ? ` ${item.visitTime}` : ""}
                    {item.nextVisitStatus ? (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                        {NEXT_VISIT_STATUS_LABEL[item.nextVisitStatus]}
                      </span>
                    ) : null}
                    {item.visitOn < today ? <span className="ml-2 text-xs text-danger">予定日を過ぎています</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {item.title}
                    {item.clinicName ? `　${item.clinicName}` : ""}
                  </p>
                </Link>
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
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-8 shadow-card">
          <p className="font-display text-lg font-semibold text-fg">まだ記録がありません</p>
          <p className="mt-2 text-sm text-muted">予定を入れておくか、ワクチンや健診の通院を残してください。</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {historyByYear.map((group) => {
            const open = openYears.includes(group.year);
            return (
              <section key={group.year}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenYears((current) =>
                      current.includes(group.year) ? current.filter((year) => year !== group.year) : [...current, group.year],
                    )
                  }
                  className="flex w-full items-baseline justify-between gap-3 py-0.5 text-left"
                >
                  <h2 className="font-display text-base font-semibold text-fg">{group.year}年</h2>
                  <span className="text-xs font-medium text-muted">{open ? "閉じる" : "開く"}</span>
                </button>
                {open ? (
                  <ul className="mt-1 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {group.items.map((visit) => (
                      <HistoryRow key={visit.id} visit={visit} />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
          {hasMore ? <div ref={sentinel} className="h-4" aria-hidden /> : null}
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

function formatMonthDay(iso: string): string {
  const parts = iso.split("-");
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function HistoryRow({ visit }: { visit: VetVisit }) {
  const detail = [visit.treatment, visit.note].map((value) => value?.trim()).filter(Boolean).join("　");
  return (
    <li>
      <Link
        to="/vet/$id/edit"
        params={{ id: visit.id }}
        className="block px-3 py-2 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
      >
        <p className="flex items-baseline gap-2 text-sm text-fg">
          <span className="shrink-0 tabular-nums">{formatMonthDay(visit.visitOn)}</span>
          {visit.clinicName ? <span className="min-w-0 flex-1 truncate text-muted">{visit.clinicName}</span> : <span className="flex-1" />}
          <span className="shrink-0 text-xs text-muted">{visit.kind}</span>
        </p>
        <p className="truncate text-sm font-medium text-fg">{visit.title}</p>
        {detail ? <p className="truncate text-xs text-muted">{detail}</p> : null}
      </Link>
    </li>
  );
}
