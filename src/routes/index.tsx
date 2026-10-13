/**
 * トップページ。未ログインはログイン画面、ログイン後はカードメニュー。
 * 犬と人のメニューは components/calorie/menu-board.tsx。色は styles.css。
 */
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { AuthSplash, LoginScreen } from "@/components/login-form";
import { DeskPanel } from "@/components/desk-panel";
import { CalorieMenuBoard } from "@/components/calorie/menu-board";
import { HomeCalorieDate } from "@/components/calorie/home-date";
import { storedDogId } from "@/components/calorie/dog-switcher";
import { getCalorieState } from "@/lib/calorie/api";
import { dailyEnergy, todayJst, truncKcal } from "@/lib/calorie/formula";
import { calorieSaburoStage } from "@/lib/calorie/saburo";
import { dogMenuSrc, personMenuSrc } from "@/lib/calorie/portraits";
import type { CalorieState } from "@/lib/calorie/types";

/** / 。セッションがあればメニュー、無ければログイン。 */
export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();

  if (user || sessionUser) {
    return (
      <AppShell>
        <MenuScreen />
      </AppShell>
    );
  }
  if (isPending) return <AuthSplash />;
  return <LoginScreen />;
}

function MenuScreen() {
  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <CardMenu />
      <DeskPanel />
    </div>
  );
}

function CardMenu() {
  const [state, setState] = useState<CalorieState | null>(null);
  const dog = state
    ? calorieSaburoStage(
        truncKcal(state.logs.reduce((sum, log) => sum + log.kcal, 0)),
        dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage),
      )
    : { src: "/calorie/saburo/01-standard.jpg", label: "今の体型" };

  useEffect(() => {
    let cancelled = false;
    getCalorieState({ data: { date: todayJst(), dogId: storedDogId() } })
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        /* 取れなくてもメニューは出す */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="メインメニュー">
        <CalorieMenuBoard
          dogSrc={dogMenuSrc(state?.dog.portraitId, dog.src)}
          personSrc={personMenuSrc(state?.personPortrait)}
          dogName={state?.dog.name || "うちの子"}
          dogLabel={dog.label}
        />
      </nav>
      {state ? <HomeCalorieDate state={state} onChange={setState} /> : null}
    </div>
  );
}
