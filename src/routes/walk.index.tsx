import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MemoCard } from "@/components/walk/memo-card";
import { MemoToolbar } from "@/components/walk/memo-toolbar";
import { WalkSubnav } from "@/components/walk/walk-subnav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkState } from "@/lib/walk/api";
import { filterMemos, householdMates, isSortKey } from "@/lib/walk/filter";
import type { DogBreed, WalkMemo, WalkSearch } from "@/lib/walk/types";

export const Route = createFileRoute("/walk/")({
  validateSearch: (search: Record<string, unknown>): WalkSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    sort: isSortKey(search.sort) ? search.sort : "name_asc",
    breed: typeof search.breed === "string" ? search.breed : "",
  }),
  component: WalkIndex,
});

function WalkIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [memos, setMemos] = useState<WalkMemo[] | null>(null);
  const [breeds, setBreeds] = useState<DogBreed[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWalkState()
      .then((state) => {
        if (cancelled) return;
        setMemos(state.memos);
        setBreeds(state.breeds);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "読み込みに失敗しました");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => (memos ? filterMemos(memos, search) : []), [memos, search]);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-sans text-xs font-medium tracking-widest text-subtle">03</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">お散歩メモ</h1>
          <p className="mt-3 max-w-prose text-sm text-muted">出会った子のカードを、静かに残します。</p>
        </div>
        <Button asChild>
          <Link to="/walk/new">追加</Link>
        </Button>
      </div>

      <WalkSubnav current="cards" />

      <MemoToolbar
        search={search}
        breeds={breeds}
        total={memos?.length ?? 0}
        shown={shown.length}
        onChange={(next) => {
          void navigate({ search: next, replace: true });
        }}
      />

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!memos ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : memos.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-8 shadow-card">
          <p className="font-display text-lg font-semibold text-fg">まだカードがありません</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            散歩で出会った子の名前と、覚えておきたいことを残してください。画像はあとからでも足せます。
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">該当するカードがありません</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((memo) => (
            <MemoCard key={memo.id} memo={memo} mates={memos ? householdMates(memos, memo) : []} />
          ))}
        </div>
      )}
    </div>
  );
}
