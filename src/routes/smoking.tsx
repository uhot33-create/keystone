/**
 * 喫煙管理のページ。
 * 画面は /smoking。タブは減算・上限の設定・バッチ。ログイン必須。
 * 最初に残り本数を読み、バッチを開いたときだけバッジを取り直す。
 * 減算や上限変更のあと、バッジの数字は画面に残っている値を維持する。
 * 見出し下の一文はリセットが日本時間0時であることの説明。
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CountPanel } from "@/components/smoking/count-panel";
import { MasterPanel } from "@/components/smoking/master-panel";
import { BadgePanel } from "@/components/smoking/badge-panel";
import { PageHeading } from "@/components/page-heading";
import { Protected } from "@/components/protected";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getSmokingBadges, getSmokingState } from "@/lib/smoking/api";
import { holdSmoking, peekSmoking, smokingBadgesLoaded } from "@/lib/smoking/held";
import type { SmokingState } from "@/lib/smoking/types";

/** 喫煙ルート。中身はログイン後の SmokingApp。 */
export const Route = createFileRoute("/smoking")({ component: SmokingPage });

function SmokingPage() {
  return (
    <Protected>
      <SmokingApp />
    </Protected>
  );
}

function SmokingApp() {
  const [tab, setTab] = useState<"count" | "master" | "badge">("count");
  const [state, setState] = useState<SmokingState | null>(() => peekSmoking());
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (tab !== "badge" || smokingBadgesLoaded()) return;
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
  }, [tab]);

  function applyState(next: SmokingState) {
    setState((prev) => {
      const merged = prev ? { ...next, badges: prev.badges } : next;
      holdSmoking(merged);
      return merged;
    });
  }

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
    </div>
  );
}

function tabClass(active: boolean) {
  return [
    "h-11 rounded-sm text-sm font-medium transition-colors duration-150",
    active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
  ].join(" ");
}
