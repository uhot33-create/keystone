import { createFileRoute } from "@tanstack/react-router";
import { Bone, CalendarDays, PawPrint, Utensils } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FoodsPanel } from "@/components/calorie/foods-panel";
import { PlanPanel } from "@/components/calorie/plan-panel";
import { ProfilePanel } from "@/components/calorie/profile-panel";
import { TodayPanel } from "@/components/calorie/today-panel";
import { Protected } from "@/components/protected";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalorieState } from "@/lib/calorie/api";
import { todayJst } from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";

export const Route = createFileRoute("/calorie")({ component: CaloriePage });

type Tab = "today" | "plan" | "foods" | "profile";

function CaloriePage() {
  return (
    <Protected>
      <CalorieApp />
    </Protected>
  );
}

function CalorieApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<CalorieState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCalorieState({ data: { date: todayJst() } })
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="stagger-in flex flex-1 flex-col gap-6 pb-24">
        <div>
          <h1 className="font-display text-3xl font-semibold text-fg">わんカロリー</h1>
          <p className="mt-1 text-sm text-muted">{state?.dog.name || "うちの子"}</p>
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
          <TodayPanel
            state={state}
            onChange={setState}
            onOpenPlan={() => setTab("plan")}
            onOpenFoods={() => setTab("foods")}
          />
        ) : tab === "plan" ? (
          <PlanPanel state={state} onChange={setState} />
        ) : tab === "foods" ? (
          <FoodsPanel state={state} onChange={setState} />
        ) : (
          <ProfilePanel state={state} onChange={setState} />
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-3xl grid-cols-4 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
          <NavBtn active={tab === "today"} label="今日" onClick={() => setTab("today")}>
            <Utensils className="size-5" strokeWidth={1.75} />
          </NavBtn>
          <NavBtn active={tab === "plan"} label="プラン" onClick={() => setTab("plan")}>
            <CalendarDays className="size-5" strokeWidth={1.75} />
          </NavBtn>
          <NavBtn active={tab === "foods"} label="フード" onClick={() => setTab("foods")}>
            <Bone className="size-5" strokeWidth={1.75} />
          </NavBtn>
          <NavBtn active={tab === "profile"} label="プロフィール" onClick={() => setTab("profile")}>
            <PawPrint className="size-5" strokeWidth={1.75} />
          </NavBtn>
        </div>
      </nav>
    </div>
  );
}

function NavBtn({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "text-primary" : "text-subtle"}`}
    >
      {children}
      {label}
    </button>
  );
}
