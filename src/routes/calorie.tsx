/**
 * 「わんカロリー」画面（URL /calorie）です。下のタブで今日・プラン・フード・プロフィールを切り替えます。
 * 中身は today-panel / plan-panel / foods-panel / profile-panel に任せています。
 * 暮らし帳から開くときは、持っているデータと日付をそのまま使う。取り直さない。
 * 直接開いたときだけ getCalorieState を取る。
 * タブの文言は一番下の NavBtn（今日／プラン／フード／プロフィール）。
 * ごはん・体重・おくすりの画面ではこのタブを出さない。
 * 見出し「わんカロリー」を変えると画面タイトルだけ変わります。
 */
import { createFileRoute } from "@tanstack/react-router";
import { Bone, CalendarDays, PawPrint, Utensils } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DogSwitcher, rememberDogId, storedDogId } from "@/components/calorie/dog-switcher";
import { FoodsPanel } from "@/components/calorie/foods-panel";
import { PlanPanel } from "@/components/calorie/plan-panel";
import { ProfilePanel } from "@/components/calorie/profile-panel";
import { TodayPanel } from "@/components/calorie/today-panel";
import { clearCalorieOpenView, peekCalorieOpenView, takeCalorieOpenTab } from "@/components/calorie/menu-board";
import { Protected } from "@/components/protected";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalorieState } from "@/lib/calorie/api";
import { holdCalorieState, peekCalorieState } from "@/lib/calorie/held";
import { todayJst } from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";

/** このURLの入口です。データは画面側で、暮らし帳から渡されたものを優先します。 */
export const Route = createFileRoute("/calorie")({
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
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<CalorieState | null>(() => peekCalorieState());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [todayHeading, setTodayHeading] = useState("わんカロリー");
  const [todayView, setTodayView] = useState<"home" | "add" | "weight" | "meds">(() => peekCalorieOpenView());
  const onHeading = useCallback((title: string) => setTodayHeading(title), []);
  const onView = useCallback((next: "home" | "add" | "weight" | "meds") => setTodayView(next), []);
  const hideNav = tab === "today" && (todayView === "add" || todayView === "weight" || todayView === "meds");

  useEffect(() => {
    clearCalorieOpenView();
    const next = takeCalorieOpenTab();
    if (next) setTab(next);
  }, []);

  useEffect(() => {
    if (peekCalorieState()) {
      rememberDogId(peekCalorieState()!.dog.id);
      return;
    }
    let cancelled = false;
    getCalorieState({ data: { date: todayJst(), dogId: storedDogId() } })
      .then((next) => {
        if (cancelled) return;
        rememberDogId(next.dog.id);
        holdCalorieState(next);
        setState(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onChange(next: CalorieState) {
    rememberDogId(next.dog.id);
    holdCalorieState(next);
    setState(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`stagger-in flex flex-1 flex-col gap-6 ${hideNav ? "pb-6" : "pb-24"}`}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-start justify-between gap-3">
              {tab === "today" && (todayHeading === "体重" || todayHeading === "ごはん") ? (
                <h1 className="font-display text-3xl font-semibold text-fg">{todayHeading}</h1>
              ) : null}
            </div>
            <p className={`text-sm text-muted ${tab === "today" && (todayHeading === "体重" || todayHeading === "ごはん") ? "mt-1" : ""}`}>
              {state?.dog.name || "うちの子"}
            </p>
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
                onHeading={onHeading}
                onOpenProfile={() => setTab("profile")}
                onView={onView}
                initialView={todayView}
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

      {hideNav ? null : (
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
      )}
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