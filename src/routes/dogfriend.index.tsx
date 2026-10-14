/**
 * お散歩カードの一覧（/dogfriend）。
 * 検索・並び・犬種は URL の search。絞り込みは filterMemos。
 * 初期の並びは名前昇順（validateSearch）。選択肢は types.ts の SORT_OPTIONS。
 * サムネは一覧のあと getWalkThumbs。肉球は touchWalkMemoMet。
 * 追加ボタンは /dogfriend/new。1 枚の見た目は MemoCard。
 */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MemoCard } from "@/components/walk/memo-card";
import { MemoToolbar } from "@/components/walk/memo-toolbar";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkState, getWalkThumbs, touchWalkMemoMet } from "@/lib/walk/api";
import { holdWalkList, peekWalkList } from "@/lib/walk/held";
import { filterMemos, householdMates, isSortKey } from "@/lib/walk/filter";
import { applyWalkThumbs } from "@/lib/walk/thumbs";
import type { DogBreed, WalkMemo, WalkSearch } from "@/lib/walk/types";

/** 一覧ルート。検索クエリは validateSearch で q / sort / breed に整える。 */
export const Route = createFileRoute("/dogfriend/")({
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
  const cached = peekWalkList();
  const [memos, setMemos] = useState<WalkMemo[] | null>(cached?.memos ?? null);
  const [breeds, setBreeds] = useState<DogBreed[]>(cached?.breeds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);
  const thumbsFetchStarted = useRef(cached?.thumbs ?? false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (peekWalkList()) return;
    let cancelled = false;
    getWalkState()
      .then((state) => {
        if (cancelled) return;
        holdWalkList({ memos: state.memos, breeds: state.breeds, thumbs: false });
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

  useEffect(() => {
    if (!memos || thumbsFetchStarted.current) return;
    thumbsFetchStarted.current = true;
    getWalkThumbs()
      .then((thumbs) => {
        setMemos((list) => {
          if (!list) return list;
          const next = applyWalkThumbs(list, thumbs);
          const current = peekWalkList();
          holdWalkList({ memos: next, breeds: current?.breeds ?? [], thumbs: true });
          return next;
        });
      })
      .catch(() => {
        /* 文字は出したまま */
      });
  }, [memos]);

  const shown = useMemo(() => (memos ? filterMemos(memos, search) : []), [memos, search]);

  async function onMetToday(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const saved = await touchWalkMemoMet({ data: { id } });
      setMemos((list) => {
        if (!list) return list;
        const next = list.map((memo) => (memo.id === saved.id ? { ...memo, lastMetOn: saved.lastMetOn } : memo));
        const current = peekWalkList();
        if (current) holdWalkList({ ...current, memos: next });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新できませんでした");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <BusyOverlay show={memos === null} label="読み込み中…" />
      <PageHeading title="おさんぽメモ">
        <Button asChild>
          <Link to="/dogfriend/new">追加</Link>
        </Button>
      </PageHeading>

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
            おさんぽで出会った子の名前と、覚えておきたいことを残してください。画像はあとからでも足せます。
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">該当するカードがありません</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              mates={memos ? householdMates(memos, memo) : []}
              pending={pendingId === memo.id}
              onMetToday={onMetToday}
            />
          ))}
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
