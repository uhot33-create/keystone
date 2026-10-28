/**
 * トップページ。未ログインはログイン画面、ログイン後はカードメニュー。
 * 犬と人のメニューは components/calorie/menu-board.tsx。色は styles.css。
 */
import { Link, createFileRoute, useRouteContext, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { AuthSplash, LoginScreen } from "@/components/login-form";
import { DeskPanel } from "@/components/desk-panel";
import { CalorieMenuBoard } from "@/components/calorie/menu-board";
import { HomeCalorieDate } from "@/components/calorie/home-date";
import { rememberDogId, storedDogId } from "@/components/calorie/dog-switcher";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { getCalorieState } from "@/lib/calorie/api";
import { holdCalorieState, peekCalorieState } from "@/lib/calorie/held";
import { dailyEnergy, todayJst, truncKcal } from "@/lib/calorie/formula";
import { calorieSaburoStage } from "@/lib/calorie/saburo";
import { dogMenuSrc, personMenuSrc } from "@/lib/calorie/portraits";
import { warmMenus } from "@/lib/warm-menus";
import type { CalorieState } from "@/lib/calorie/types";

/** / 。セッションがあればメニュー、無ければログイン。 */
export const Route = createFileRoute("/")({ component: Home });

/** ログイン済み（セッションかクライアント）ならメニュー。確認中は待ち、未ログインはログイン画面。 */
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

/** カードメニューと机。机の中身は DeskPanel。 */
function MenuScreen() {
  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <CardMenu />
      <DeskPanel />
    </div>
  );
}

/** 犬と人のカード、見ている日。日付の変更は HomeCalorieDate が publish へ返す。 */
function CardMenu() {
  const router = useRouter();
  const [state, setState] = useState<CalorieState | null>(() => peekCalorieState());
  const [board, setBoard] = useState<"dog" | "person">("dog");
  const [busy, setBusy] = useState(false);
  const dog = state
    ? calorieSaburoStage(
        truncKcal(state.logs.reduce((sum, log) => sum + log.kcal, 0)),
        dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage),
      )
    : { src: "/calorie/saburo/01-standard.jpg", label: "今の体型" };

  /** メニュー先の部品とデータを先に読む。一度だけ。失敗してもこの画面は出す。処理は warm-menus.ts。 */
  useEffect(() => {
    warmMenus(router);
  }, [router]);

  /** キャッシュが無ければ、今日（日本時間）と前回の犬で getCalorieState を取る。日付は state.date として残す。 */
  useEffect(() => {
    if (peekCalorieState()) return;
    let cancelled = false;
    getCalorieState({ data: { date: todayJst(), dogId: storedDogId() } })
      .then((next) => {
        if (cancelled) return;
        holdCalorieState(next);
        setState(next);
      })
      .catch(() => {
        /* 取れなくてもメニューは出す */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 日付変更や犬の切り替えの結果を、画面とキャッシュの両方に置く。 */
  function publish(next: CalorieState) {
    holdCalorieState(next);
    setState(next);
  }

  /** 別の犬を選ぶ。日付は今見ている日のまま。犬 id は rememberDogId に残し、次の取得で使う。 */
  async function selectDog(dogId: number) {
    if (!state || dogId === state.dog.id) return;
    setBusy(true);
    try {
      rememberDogId(dogId);
      publish(await getCalorieState({ data: { date: state.date, dogId } }));
    } catch {
      /* 失敗しても今の犬のまま */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-5">
      <BusyOverlay show={busy} label="読み込み中…" />
      <nav aria-label="メインメニュー">
        <CalorieMenuBoard
          dogSrc={dogMenuSrc(state?.dog.portraitId, dog.src)}
          personSrc={personMenuSrc(state?.personPortrait)}
          dogName={state?.dog.name || "うちの子"}
          dogLabel={dog.label}
          dogs={state?.dogs}
          dogId={state?.dog.id}
          onSelectDog={(id) => void selectDog(id)}
          onBoard={setBoard}
        />
      </nav>
      {state && board === "dog" && state.dogs.length >= 2 ? (
        <Link
          to="/calorie-batch"
          search={{ date: state.date }}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          体重とごはんをまとめて
        </Link>
      ) : null}
      {state ? <HomeCalorieDate state={state} onChange={publish} dogDay={board === "dog"} /> : null}
    </div>
  );
}
