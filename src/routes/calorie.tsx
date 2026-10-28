/**
 * 「わんカロリー」画面（URL /calorie）です。
 * ごはん・体重・おくすりは日付つきの入力。プランとフードはプロフィールから開きます。
 * 暮らし帳から開くときは、持っているデータと日付をそのまま使う。取り直さない。
 * 直接開いたときだけ getCalorieState を取る。
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { DogSwitcher, rememberDogId, storedDogId } from "@/components/calorie/dog-switcher";
import { FoodsPanel } from "@/components/calorie/foods-panel";
import { PlanPanel } from "@/components/calorie/plan-panel";
import { ProfilePanel } from "@/components/calorie/profile-panel";
import { TodayPanel } from "@/components/calorie/today-panel";
import { clearCalorieOpenView, peekCalorieOpenView, takeCalorieOpenTab } from "@/components/calorie/menu-board";
import { Protected } from "@/components/protected";
import { PageHeading } from "@/components/page-heading";
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

/** 今日・プラン・フード・プロフィール。下のタブは使わない。 */
type Tab = "today" | "plan" | "foods" | "profile";

/** 未ログインは Protected が止める。画面の状態は CalorieApp。 */
function CaloriePage() {
  return (
    <Protected>
      <CalorieApp />
    </Protected>
  );
}

/** 今日・プラン・フード・プロフィール。入力の保存は各パネル、サーバーは lib/calorie/api.ts。 */
function CalorieApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<CalorieState | null>(() => peekCalorieState());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openedView] = useState(() => peekCalorieOpenView());
  const [todayHeading, setTodayHeading] = useState(() =>
    openedView === "add" ? "ごはん" : openedView === "weight" ? "体重" : openedView === "meds" ? "お世話" : "",
  );
  const onHeading = useCallback((title: string) => setTodayHeading(title), []);
  const pageTitle = tab === "plan" ? "プラン" : tab === "foods" ? "フード" : tab === "profile" ? "プロフィール" : todayHeading;
  const quick = tab === "today" && (todayHeading === "ごはん" || todayHeading === "体重" || todayHeading === "お世話");

  /** メニューが渡した初期ビューを消し、開くタブがあれば切り替える。日付はここでは動かさない。 */
  useEffect(() => {
    clearCalorieOpenView();
    const next = takeCalorieOpenTab();
    if (next) setTab(next);
  }, []);

  /** 暮らし帳のキャッシュがあればそれを使う。無ければ今日（JST）と保存済みの犬で取り、日付ごと hold する。 */
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

  /** パネルが返した状態をキャッシュへ戻す。見ている日は next.date のまま。 */
  function onChange(next: CalorieState) {
    rememberDogId(next.dog.id);
    holdCalorieState(next);
    setState(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="stagger-in flex flex-1 flex-col gap-4">
        {pageTitle ? (
          <PageHeading title={pageTitle}>
            {tab === "plan" || tab === "foods" ? (
              <button type="button" className="text-sm font-medium text-primary" onClick={() => setTab("profile")}>
                プロフィール
              </button>
            ) : null}
          </PageHeading>
        ) : null}
        {quick ? null : (
          <div className="flex flex-col gap-3">
            {pageTitle ? null : <p className="text-sm text-muted">{state?.dog.name || "うちの子"}</p>}
            {state ? <DogSwitcher state={state} onChange={onChange} onBusy={setBusy} onError={setError} /> : null}
          </div>
        )}

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
                initialView={openedView}
              />
            ) : tab === "plan" ? (
              <PlanPanel state={state} onChange={onChange} />
            ) : tab === "foods" ? (
              <FoodsPanel state={state} onChange={onChange} />
            ) : (
              <ProfilePanel state={state} onChange={onChange} onOpenPlan={() => setTab("plan")} onOpenFoods={() => setTab("foods")} />
            )}
          </>
        )}
      </div>
    </div>
  );
}