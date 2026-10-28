/**
 * お散歩カードの一覧（/dogfriend）。
 * 検索・並び・犬種は URL の search。絞り込みは filterMemos。
 * 初期の並びは名前昇順（validateSearch）。選択肢は types.ts の SORT_OPTIONS。
 * サムネは一覧のあと getWalkThumbs。肉球は touchWalkMemoMet。
 * 同じ飼い主のほかの犬は、一頭ずつはい／いいえで今日にする。
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
import { getWalkState, getWalkThumbs, restoreWalkMemoMet, touchWalkMemoMet } from "@/lib/walk/api";
import { holdWalkList, peekWalkList } from "@/lib/walk/held";
import { filterMemos, householdMates, householdOthers, isSortKey } from "@/lib/walk/filter";
import { applyWalkThumbs } from "@/lib/walk/thumbs";
import type { DogBreed, WalkMemo, WalkSearch } from "@/lib/walk/types";

/**
 * 一覧ルート。検索クエリは validateSearch で q / sort / breed に整える。
 * 画面は /dogfriend。並びが不正なら名前昇順。実装は WalkIndex。
 * 並びの許可リストは filter.ts の isSortKey と types.ts の SORT_OPTIONS。
 */
export const Route = createFileRoute("/dogfriend/")({
  validateSearch: (search: Record<string, unknown>): WalkSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    sort: isSortKey(search.sort) ? search.sort : "name_asc",
    breed: typeof search.breed === "string" ? search.breed : "",
  }),
  component: WalkIndex,
});

/**
 * 一覧。検索は URL、カードはキャッシュ優先。今日にする処理とサムネはここで取る。
 * 画面は /dogfriend。1枚の見た目は MemoCard。追加は /dogfriend/new。
 * 控えがあるあいだ getWalkState は走らない（保存・削除で drop するまで）。
 */
function WalkIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cached = peekWalkList();
  const [memos, setMemos] = useState<WalkMemo[] | null>(cached?.memos ?? null);
  const [breeds, setBreeds] = useState<DogBreed[]>(cached?.breeds ?? []);
  const [error, setError] = useState<string | null>(null);
  // 肉球か戻す処理中のカード id。そのカードだけ押せなくする。
  const [pendingId, setPendingId] = useState<string | null>(null);
  // 今日にする確認の残り。同じ飼い主で、まだその日になっていない犬だけ。
  const [follow, setFollow] = useState<WalkMemo[]>([]);
  const [showTop, setShowTop] = useState(false);
  // サムネ取得を始めたか。控えに thumbs 済みなら最初から true で取り直さない。
  const thumbsFetchStarted = useRef(cached?.thumbs ?? false);

  /**
   * 240px より下へスクロールしたら TOP を出す。データの取得ではない。
   * 画面は /dogfriend。しきい値を変えるなら 240。
   */
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * 控え（held.ts）があれば通信しない。保存・削除で dropWalkList されるまで取り直さない。
   * 画面は /dogfriend。取るのは getWalkState（サムネ無し）。検索条件は URL のまま。
   * 肉球や戻す操作は手元の配列と控えを書き換えるだけで、ここでは再取得しない。
   */
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

  /**
   * 一覧のあと、一度だけサムネを足す。失敗しても文字のカードは残す。
   * 画面は /dogfriend。取得は getWalkThumbs、合成は applyWalkThumbs。
   * 控えの thumbs が true なら開始しない（同じタブで戻ったとき二重に取らない）。
   */
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

  /**
   * 検索語・並び・犬種で絞る。規則は filterMemos。URL の search を変えるとここが変わる。
   * 画面は /dogfriend。件数はツールバーの shown。カードの並びもこの結果。
   */
  const shown = useMemo(() => (memos ? filterMemos(memos, search) : []), [memos, search]);

  /**
   * そのカードを今日にする。同じ飼い主のほかの犬がいれば、一頭ずつ確認を出す。
   * 画面は一覧の肉球。更新は touchWalkMemoMet（虹渡りはサーバーが拒否）。
   * 聞く相手は householdOthers。すでにその日付の犬・虹渡りは聞かない。
   */
  async function onMetToday(id: string) {
    const list = memos;
    setPendingId(id);
    setError(null);
    try {
      const saved = await touchWalkMemoMet({ data: { id } });
      setMemos((current) => {
        if (!current) return current;
        const next = current.map((memo) =>
          memo.id === saved.id ? { ...memo, lastMetOn: saved.lastMetOn, prevLastMetOn: saved.prevLastMetOn } : memo,
        );
        const held = peekWalkList();
        if (held) holdWalkList({ ...held, memos: next });
        return next;
      });
      const source = list?.find((memo) => memo.id === id);
      if (source && saved.lastMetOn) {
        const others = householdOthers(list ?? [], source, saved.lastMetOn);
        if (others.length > 0) setFollow(others);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新できませんでした");
    } finally {
      setPendingId(null);
    }
  }

  /**
   * 確認ダイアログの返事。いいえは次の犬へ。はいならその犬も今日にする。
   * 画面は一覧の「ほかの犬」ダイアログ。はいも touchWalkMemoMet。日付は今日（on を渡さない）。
   * 編集保存のときは memo-form の answerFollow（指定した日）。ここは今日だけ。
   */
  async function answerFollow(yes: boolean) {
    const dog = follow[0];
    if (!dog || pendingId) return;
    if (!yes) {
      setFollow((queue) => queue.slice(1));
      return;
    }
    setPendingId(dog.id);
    setError(null);
    try {
      const saved = await touchWalkMemoMet({ data: { id: dog.id } });
      setMemos((current) => {
        if (!current) return current;
        const next = current.map((memo) =>
          memo.id === saved.id ? { ...memo, lastMetOn: saved.lastMetOn, prevLastMetOn: saved.prevLastMetOn } : memo,
        );
        const held = peekWalkList();
        if (held) holdWalkList({ ...held, memos: next });
        return next;
      });
      setFollow((queue) => queue.slice(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新できませんでした");
    } finally {
      setPendingId(null);
    }
  }

  /**
   * 最後に会った日を、ひとつ前の日付へ戻す。確認ダイアログの日付は prevLastMetOn。
   * 画面は一覧カードの「○に戻す」。中身は restoreWalkMemoMet（last と prev を入れ替える）。
   * 履歴は1世代。戻したあとは手元の配列と控えも同じ日付に書き換える。再取得はしない。
   */
  async function onRestoreMet(id: string) {
    const memo = memos?.find((item) => item.id === id);
    if (!memo?.prevLastMetOn) return;
    const [year, month, day] = memo.prevLastMetOn.split("-");
    const label = `${year}/${Number(month)}/${Number(day)}`;
    if (!window.confirm(`${memo.name} の最後に会った日を ${label} に戻しますか？`)) return;
    setPendingId(id);
    setError(null);
    try {
      const saved = await restoreWalkMemoMet({ data: { id } });
      setMemos((current) => {
        if (!current) return current;
        const next = current.map((item) =>
          item.id === saved.id ? { ...item, lastMetOn: saved.lastMetOn, prevLastMetOn: saved.prevLastMetOn } : item,
        );
        const held = peekWalkList();
        if (held) holdWalkList({ ...held, memos: next });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "戻せませんでした");
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
              onRestoreMet={onRestoreMet}
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
      {follow[0] ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-fg/45 p-6" role="dialog" aria-label="ほかの犬">
          <div className="w-full max-w-xs rounded-xl border border-border bg-surface px-5 py-6 shadow-card">
            <p className="text-sm leading-relaxed text-fg">
              {follow[0].name} の最後に会った日も今日にしますか？
            </p>
            {follow[0].ownerName ? <p className="mt-2 text-xs text-muted">飼い主 {follow[0].ownerName}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={pendingId !== null} onClick={() => void answerFollow(false)}>
                いいえ
              </Button>
              <Button type="button" disabled={pendingId !== null} onClick={() => void answerFollow(true)}>
                はい
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
