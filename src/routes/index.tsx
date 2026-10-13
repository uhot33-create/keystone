/**
 * トップページ。未ログインはログイン画面、ログイン後はメニュー。
 * 項目の名前と順番は lib/app-meta.ts の MENUS。アイコンは下の ICONS を同じパスで揃える。
 * カードかアイコンかは lib/menu-layout.ts。カードはわんカロリーのメニュー。色は styles.css。
 */
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cigarette, Footprints, PawPrint, Soup, Stethoscope } from "lucide-react";
import { MENUS } from "@/lib/app-meta";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMenuLayout } from "@/lib/menu-layout";
import { AppShell } from "@/components/app-shell";
import { AuthSplash, LoginScreen } from "@/components/login-form";
import { DeskPanel } from "@/components/desk-panel";
import { CalorieMenuBoard } from "@/components/calorie/menu-board";
import { HomeCalorieDate } from "@/components/calorie/home-date";
import { storedDogId } from "@/components/calorie/dog-switcher";
import { getCalorieState } from "@/lib/calorie/api";
import { dailyEnergy, todayJst, truncKcal } from "@/lib/calorie/formula";
import { calorieSaburoStage } from "@/lib/calorie/saburo";
import type { CalorieState } from "@/lib/calorie/types";

/** / 。セッションがあればメニュー、無ければログイン。 */
export const Route = createFileRoute("/")({ component: Home });

/** パスとアイコンの対応。MENUS に項目を足したら、同じパスをここにも足す。 */
const ICONS = {
  "/calorie": PawPrint,
  "/smoking": Cigarette,
  "/walk": Footprints,
  "/vet": Stethoscope,
  "/cup": Soup,
} as const;

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
  const layout = useMenuLayout();

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      {layout === "cards" ? <CardMenu /> : <IconMenu />}
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
        <CalorieMenuBoard dogSrc={dog.src} dogLabel={dog.label} />
      </nav>
      {state ? <HomeCalorieDate state={state} onChange={setState} /> : null}
    </div>
  );
}

function IconMenu() {
  return (
    <nav aria-label="メインメニュー" className="grid grid-cols-2 gap-3">
      {MENUS.map((item) => {
        const Icon = ICONS[item.to];
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-3 py-5 text-center shadow-card outline-none transition-colors duration-150 ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-primary">
              <Icon className="size-7" strokeWidth={1.75} />
            </span>
            <span className="font-display text-sm font-semibold text-fg">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
