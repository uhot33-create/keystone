/**
 * 喫煙管理のページ。
 * 画面は /smoking。タブは減算・上限の設定・バッチ。ログイン必須。
 * 最初に残り本数を読み、バッチを開いたときだけバッジを取り直す。
 * 減算や上限変更のあと、バッジの数字は画面に残っている値を維持する。
 * 見出し下の一文はリセットが日本時間0時であることの説明。
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CountPanel } from "@/components/smoking/count-panel";
import { MasterPanel } from "@/components/smoking/master-panel";
import { BadgePanel } from "@/components/smoking/badge-panel";
import { PageHeading } from "@/components/page-heading";
import { Protected } from "@/components/protected";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSmokingBadges, getSmokingState } from "@/lib/smoking/api";
import { markCheersSeen, pendingCheers, type Cheer } from "@/lib/smoking/celebrate";
import { holdSmoking, peekSmoking, smokingBadgesLoaded } from "@/lib/smoking/held";
import type { SmokingState } from "@/lib/smoking/types";

/** 喫煙ルート。中身はログイン後の SmokingApp。 */
export const Route = createFileRoute("/smoking")({ component: SmokingPage });

/** 未ログインは Protected が止める。タブと取得は SmokingApp。 */
function SmokingPage() {
  return (
    <Protected>
      <SmokingApp />
    </Protected>
  );
}

/** 減算・上限・バッチ。残り本数は getSmokingState、バッジは getSmokingBadges。判定は lib/smoking。 */
function SmokingApp() {
  const [tab, setTab] = useState<"count" | "master" | "badge">("count");
  const [state, setState] = useState<SmokingState | null>(() => peekSmoking());
  const [error, setError] = useState<string | null>(null);
  const [cheers, setCheers] = useState<Cheer[]>([]);
  const [cheerIndex, setCheerIndex] = useState(0);
  const askedBadges = useRef(false);

  /** キャッシュが無ければ残り本数を取る。日付の区切りはサーバー側（日本時間0時）。 */
  useEffect(() => {
    if (peekSmoking()) return;
    let cancelled = false;
    getSmokingState()
      .then((next) => {
        if (cancelled) return;
        holdSmoking(next);
        setState(next);
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

  /** 状態が来ていてバッジ未取得なら、一度だけバッジを足す。減算のたびに取り直さない。 */
  useEffect(() => {
    if (!state || smokingBadgesLoaded() || askedBadges.current) return;
    askedBadges.current = true;
    let cancelled = false;
    getSmokingBadges()
      .then((badges) => {
        if (!cancelled) {
          setState((prev) => {
            if (!prev) return prev;
            const next = { ...prev, badges };
            holdSmoking(next, true);
            return next;
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "バッチを読み込めませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const badgeStamp =
    state && smokingBadgesLoaded()
      ? [
          state.badges.lastEvaluatedOn,
          state.badges.lifetimeNice,
          state.badges.streak,
          state.badges.wonderfulCount,
          state.badges.veryNiceCount,
          state.badges.quietWeekCount,
          state.badges.weekEarned,
          state.badges.monthEarned,
          state.badges.hundredEarned,
          state.badges.startEarned,
        ].join(":")
      : "";

  /** バッジの数字が変わったときだけ、未受け取りの達成を出す。見た扱いは celebrate.ts。 */
  useEffect(() => {
    const current = peekSmoking();
    if (!current || !badgeStamp) return;
    const next = pendingCheers(current.badges);
    if (next.length === 0) {
      markCheersSeen(current.badges);
      return;
    }
    setCheerIndex(0);
    setCheers(next);
  }, [badgeStamp]);

  /** 減算・上限の結果を載せる。バッジは画面の値を残す。期間が変わったときだけバッジを取り直す。 */
  function applyState(next: SmokingState) {
    setState((prev) => {
      const periodChanged = Boolean(prev && next.periodStartedAt !== prev.periodStartedAt);
      const merged = prev ? { ...next, badges: prev.badges } : next;
      holdSmoking(merged);
      if (periodChanged) {
        void getSmokingBadges()
          .then((badges) => {
            setState((current) => {
              if (!current) return current;
              const withBadges = { ...current, badges };
              holdSmoking(withBadges, true);
              return withBadges;
            });
          })
          .catch(() => undefined);
      }
      return merged;
    });
  }

  /** 達成が複数あれば次へ、最後なら受け取り済みにして閉じる。 */
  function closeCheer() {
    if (!state) return;
    if (cheerIndex + 1 < cheers.length) {
      setCheerIndex((index) => index + 1);
      return;
    }
    markCheersSeen(state.badges);
    setCheers([]);
  }

  const cheer = cheers[cheerIndex];

  return (
    <div className="stagger-in flex flex-1 flex-col gap-3">
      <PageHeading title="喫煙管理" />
      <p className="text-xs text-muted">毎日0時（日本時間）に上限へ戻ります。</p>

      <div className="grid grid-cols-3 rounded-md bg-surface-2 p-1">
        <button type="button" className={tabClass(tab === "count")} onClick={() => setTab("count")}>
          減算
        </button>
        <button type="button" className={tabClass(tab === "master")} onClick={() => setTab("master")}>
          上限の設定
        </button>
        <button type="button" className={tabClass(tab === "badge")} onClick={() => setTab("badge")}>
          バッチ
        </button>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!state ? (
        <div className="space-y-3">
          <BusyOverlay show label="読み込み中…" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : tab === "count" ? (
        <CountPanel state={state} onChange={applyState} />
      ) : tab === "master" ? (
        <MasterPanel state={state} onChange={applyState} />
      ) : (
        <BadgePanel state={state} />
      )}
      {cheer ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-fg/45 p-6" role="dialog" aria-label="達成">
          <div className="w-full max-w-xs rounded-xl border border-border bg-surface px-6 py-7 text-center shadow-card">
            <p className="text-xs font-medium tracking-widest text-subtle">達成</p>
            <div className="mx-auto mt-4 grid size-36 place-items-center rounded-full border-4 border-danger rotate-[-2deg] bg-surface">
              <div className="grid size-28 place-items-center rounded-full border border-danger">
                <span className="font-display text-xl font-semibold tracking-[0.2em] text-danger" style={{ writingMode: "vertical-rl" }}>
                  {cheer.title}
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm text-fg">{cheer.line}</p>
            <Button type="button" className="mt-6 w-full" onClick={closeCheer}>
              {cheerIndex + 1 < cheers.length ? "次へ" : "受け取る"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** タブボタンの見た目。選択中だけ地色を出す。文言は呼び出し側。 */
function tabClass(active: boolean) {
  return [
    "h-11 rounded-sm text-sm font-medium transition-colors duration-150",
    active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
  ].join(" ");
}
