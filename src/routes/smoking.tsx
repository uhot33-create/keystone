import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CountPanel } from "@/components/smoking/count-panel";
import { MasterPanel } from "@/components/smoking/master-panel";
import { BadgePanel } from "@/components/smoking/badge-panel";
import { Protected } from "@/components/protected";
import { Skeleton } from "@/components/ui/skeleton";
import { getSmokingState } from "@/lib/smoking/api";
import type { SmokingState } from "@/lib/smoking/types";

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
  const [state, setState] = useState<SmokingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSmokingState()
      .then((next) => {
        if (!cancelled) setState(next);
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

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <div>
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">02</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">喫煙管理</h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          1日の上限を決めて、吸った分だけ減らします。毎日0時（日本時間）に上限へ戻ります。
        </p>
      </div>

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
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : tab === "count" ? (
        <CountPanel state={state} onChange={setState} onOpenMaster={() => setTab("master")} />
      ) : tab === "master" ? (
        <MasterPanel state={state} onChange={setState} />
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
