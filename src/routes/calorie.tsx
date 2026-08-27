import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlanPanel } from "@/components/calorie/plan-panel";
import { TodayPanel } from "@/components/calorie/today-panel";
import { Protected } from "@/components/protected";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalorieState } from "@/lib/calorie/api";
import { todayJst } from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";

export const Route = createFileRoute("/calorie")({ component: CaloriePage });

function CaloriePage() {
  return (
    <Protected>
      <CalorieApp />
    </Protected>
  );
}

function CalorieApp() {
  const [tab, setTab] = useState<"today" | "plan">("today");
  const [state, setState] = useState<CalorieState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCalorieState({ data: { date: todayJst() } })
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
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">01</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">わんカロリー</h1>
        <p className="mt-3 max-w-prose text-sm text-muted">
          1日のカロリーを足して記録し、理想体重に必要な量をフードとおやつから計算します。
        </p>
      </div>

      <div className="grid grid-cols-2 rounded-md bg-surface-2 p-1">
        <button type="button" className={tabClass(tab === "today")} onClick={() => setTab("today")}>
          今日の記録
        </button>
        <button type="button" className={tabClass(tab === "plan")} onClick={() => setTab("plan")}>
          必要カロリー
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
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : tab === "today" ? (
        <TodayPanel state={state} onChange={setState} onOpenPlan={() => setTab("plan")} />
      ) : (
        <PlanPanel state={state} onChange={setState} />
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
