import { createFileRoute, Link } from "@tanstack/react-router";
import { Bone, CalendarDays, Footprints, PawPrint, Stethoscope, Utensils } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DogSwitcher, rememberDogId, storedDogId } from "@/components/calorie/dog-switcher";
import { FoodsPanel } from "@/components/calorie/foods-panel";
import { PlanPanel } from "@/components/calorie/plan-panel";
import { ProfilePanel } from "@/components/calorie/profile-panel";
import { TodayPanel } from "@/components/calorie/today-panel";
import { Protected } from "@/components/protected";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalorieState } from "@/lib/calorie/api";
import { todayJst } from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

export const Route = createFileRoute("/calorie")({
  loader: async ({ context }) => {
    if (!context.sessionUser) return null;
    return getCalorieState({ data: { date: todayJst(), dogId: storedDogId() } });
  },
  component: CaloriePage,
});

type Tab = "today" | "plan" | "foods" | "profile";

function CaloriePage() {
  return (
    <Protected>
      <CalorieApp />
    </Protected>
  );
}

function CalorieApp() {
  const loaded = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<CalorieState | null>(loaded);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const wanted = storedDogId();
    if (wanted && wanted !== loaded.dog.id && loaded.dogs.some((dog) => dog.id === wanted)) {
      let cancelled = false;
      getCalorieState({ data: { date: todayJst(), dogId: wanted } })
        .then((next) => {
          if (cancelled) return;
          rememberDogId(next.dog.id);
          setState(next);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
        });
      return () => {
        cancelled = true;
      };
    }
    rememberDogId(loaded.dog.id);
    setState(loaded);
  }, [loaded]);

  function onChange(next: CalorieState) {
    rememberDogId(next.dog.id);
    setState(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="stagger-in flex flex-1 flex-col gap-4 pb-24">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-fg">わんカロリー</h1>
              <p className="truncate text-xs text-muted">{state?.dog.name || "うちの子"}</p>
            </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to="/walk"
                  search={DEFAULT_WALK_SEARCH}
                  aria-label="お散歩メモ"
                  title="お散歩メモ"
                  className="grid size-12 place-items-center rounded-xl border border-border bg-surface shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-fg">
                    <Footprints className="size-4" strokeWidth={1.75} />
                  </span>
                </Link>
                <Link
                  to="/vet"
                  aria-label="通院履歴"
                  title="通院履歴"
                  className="grid size-12 place-items-center rounded-xl border border-border bg-surface shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-fg">
                    <Stethoscope className="size-4" strokeWidth={1.75} />
                  </span>
                </Link>
              </div>
          </div>
          {state ? (
            <DogSwitcher state={state} onChange={onChange} onBusy={setBusy} onError={setError} />
          ) : null}
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
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <BusyOverlay show={Boolean(busy)} label={busy ?? "処理中…"} />
            {tab === "today" ? (
              <TodayPanel
                state={state}
                onChange={onChange}
                onOpenFoods={() => setTab("foods")}
              />
            ) : tab === "plan" ? (
              <PlanPanel state={state} onChange={onChange} />
            ) : tab === "foods" ? (
              <FoodsPanel state={state} onChange={onChange} />
            ) : (
              <ProfilePanel state={state} onChange={onChange} />
            )}
          </>
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