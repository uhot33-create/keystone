/**
 * 「わんカロリー」画面（URL /calorie）です。下のタブで今日・プラン・フード・プロフィールを切り替えます。
 * 中身は today-panel / plan-panel / foods-panel / profile-panel に任せています。
 * 最初の読み込みは今日（日本時間）と、前回選んだ犬（localStorage の calorie-dog-id）です。
 * タブの文言は一番下の NavBtn（今日／プラン／フード／プロフィール）です。
 * 見出し「わんカロリー」を変えると画面タイトルだけ変わります。データの取得は api.ts の getCalorieState。
 * 未ログインのときは Protected が止め、loader は session が無いと null を返して画面側で取り直します。
 */
import { createFileRoute } from "@tanstack/react-router";
import { Bone, CalendarDays, PawPrint, Utensils } from "lucide-react";
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

/**
 * このURLの入口です。ログイン済みなら、今日の日付と前回の犬で getCalorieState を先に取ります。
 * 未ログインのときは null。画面側の useEffect がもう一度取りにいきます。
 */
export const Route = createFileRoute("/calorie")({
  loader: async ({ context }) => {
    if (!context.sessionUser) return null;
    return getCalorieState({ data: { date: todayJst(), dogId: storedDogId() } });
  },
  component: CaloriePage,
});

/** 下の4タブ。today が初期表示です。id を増やすときは下の NavBtn とパネルの分岐も足してください。 */
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
    let cancelled = false;
    if (!loaded) {
      getCalorieState({ data: { date: todayJst(), dogId: storedDogId() } })
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
    const wanted = storedDogId();
    if (wanted && wanted !== loaded.dog.id && loaded.dogs.some((dog) => dog.id === wanted)) {
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
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  function onChange(next: CalorieState) {
    rememberDogId(next.dog.id);
    setState(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="stagger-in flex flex-1 flex-col gap-6 pb-24">
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl font-semibold text-fg">わんカロリー</h1>
            </div>
            <p className="mt-1 text-sm text-muted">{state?.dog.name || "うちの子"}</p>
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
            {error ? null : <BusyOverlay show label="読み込み中…" />}
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

/** 下のタブボタンです。label が表示文言、children がアイコン。active のときだけ primary 色になります。 */
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