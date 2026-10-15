/**
 * 犬の絵をタップすると、次の犬、最後に人のメニューへ進む。人の次は最初の犬。
 * 犬が3匹以上のときは、左上の「人」で人のメニューへ直接移る。
 * 歯車はプロフィール画面を開く。メニューの並びは変えない。
 */
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Cigarette, Footprints, Map, Pill, Scale, Settings, Soup, Stethoscope, Utensils } from "lucide-react";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

const OPEN_VIEW_KEY = "calorie-open-view";
const OPEN_TAB_KEY = "calorie-open-tab";

export type CalorieMenuView = "weight" | "add" | "meds";

/** 暮らし帳から開く画面。読むだけ。 */
export function peekCalorieOpenView(): "home" | CalorieMenuView {
  if (typeof sessionStorage === "undefined") return "home";
  const value = sessionStorage.getItem(OPEN_VIEW_KEY);
  if (value === "weight" || value === "add" || value === "meds") return value;
  return "home";
}

/** 開いたあとに消す。 */
export function clearCalorieOpenView() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(OPEN_VIEW_KEY);
}

/** 暮らし帳から開いたあと、今日画面が一度だけ読む。読んだら消す。 */
export function takeCalorieOpenView(): "home" | CalorieMenuView {
  const value = peekCalorieOpenView();
  clearCalorieOpenView();
  return value;
}

/** 歯車から開いたプロフィール。一度だけ読む。 */
export function takeCalorieOpenTab(): "profile" | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(OPEN_TAB_KEY);
  sessionStorage.removeItem(OPEN_TAB_KEY);
  return value === "profile" ? "profile" : null;
}

const MENU = [
  { key: "food", label: "ごはん", Icon: Utensils, view: "add" as const },
  { key: "weight", label: "体重", Icon: Scale, view: "weight" as const },
  { key: "meds", label: "おくすり", Icon: Pill, view: "meds" as const },
  { key: "memo", label: "おさんぽメモ", Icon: Footprints, to: "/dogfriend" as const },
  { key: "logs", label: "おさんぽログ", Icon: Map, to: "/dogwalklogs" as const },
  { key: "vet", label: "通院履歴", Icon: Stethoscope, to: "/vet" as const },
] as const;

const PERSON_MENU = [
  { key: "smoke", label: "喫煙管理", Icon: Cigarette, to: "/smoking" as const },
  { key: "cup", label: "カップ麺", Icon: Soup, to: "/cup" as const },
] as const;

const itemClass =
  "flex h-8 items-center gap-2 border border-fg/25 bg-surface px-2.5 text-sm font-semibold text-fg shadow-card outline-none hover:bg-primary hover:text-primary-fg focus-visible:ring-2 focus-visible:ring-ring/35";

function face(Icon: (typeof MENU)[number]["Icon"], label: string): ReactNode {
  return (
    <>
      <span aria-hidden className="text-[10px]">
        ▶
      </span>
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </>
  );
}

export function CalorieMenuBoard({
  dogSrc,
  dogName,
  dogLabel,
  personSrc = "/calorie/person.jpg",
  dogs = [],
  dogId,
  onSelectDog,
  onView,
  onOpenProfile,
  onBoard,
}: {
  dogSrc: string;
  dogName: string;
  dogLabel: string;
  personSrc?: string;
  dogs?: { id: number; name: string }[];
  dogId?: number;
  onSelectDog?: (id: number) => void;
  onView?: (view: CalorieMenuView) => void;
  onOpenProfile?: () => void;
  onBoard?: (board: "dog" | "person") => void;
}) {
  const navigate = useNavigate();
  const [board, setBoard] = useState<"dog" | "person">("dog");
  const dogIndex = dogs.findIndex((dog) => dog.id === dogId);
  const nextDog = dogIndex >= 0 ? dogs[dogIndex + 1] : undefined;

  function showBoard(next: "dog" | "person") {
    setBoard(next);
    onBoard?.(next);
  }

  function onPortrait() {
    if (board === "person") {
      const first = dogs[0];
      if (first && first.id !== dogId) onSelectDog?.(first.id);
      showBoard("dog");
      return;
    }
    if (nextDog) {
      onSelectDog?.(nextDog.id);
      return;
    }
    showBoard("person");
  }

  function openProfile() {
    if (onOpenProfile) {
      onOpenProfile();
      return;
    }
    try {
      sessionStorage.setItem(OPEN_TAB_KEY, "profile");
    } catch {
      /* 保存できなくても画面は開く */
    }
    void navigate({ to: "/calorie" });
  }

  return (
    <section className="rounded-sm bg-surface p-1 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_16px_32px_-22px_var(--color-fg)] ring-1 ring-fg/80">
      <div className="rounded-[2px] border border-fg/40 p-1">
        <div className="flex h-[15.5rem] items-stretch gap-3 overflow-hidden border border-fg/15 bg-surface-2">
          <div className="relative w-40 shrink-0 self-stretch overflow-hidden border-r border-fg/20 bg-surface">
            <button
              type="button"
              className="absolute inset-0 cursor-pointer"
              aria-label={
                board === "person" ? "最初の犬のメニューに切り替え" : nextDog ? `${nextDog.name}のメニューに切り替え` : "人のメニューに切り替え"
              }
              onClick={onPortrait}
            />
            <img
              src={board === "dog" ? dogSrc : personSrc}
              alt={board === "dog" ? dogName : "人"}
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
            {board === "dog" && dogs.length >= 3 ? (
              <button
                type="button"
                className="absolute left-1 top-1 z-10 h-7 rounded-full bg-surface/90 px-2 text-[11px] font-medium text-fg shadow-card"
                aria-label="人のメニューへ"
                onClick={() => showBoard("person")}
              >
                人
              </button>
            ) : null}
            {board === "dog" ? (
              <button
                type="button"
                className="absolute right-1 top-1 z-10 grid size-7 place-items-center rounded-full bg-surface/90 text-fg shadow-card"
                aria-label="プロフィール"
                onClick={openProfile}
              >
                <Settings className="size-4" strokeWidth={1.75} />
              </button>
            ) : null}
            {board === "dog" ? (
              <p className="pointer-events-none absolute inset-x-1 bottom-6 text-center text-[11px] leading-tight text-fg [text-shadow:0_1px_2px_rgba(255,255,255,0.9)]">
                {dogLabel}
              </p>
            ) : null}
            <p className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-surface/80 py-0.5 text-[11px] leading-tight text-muted">
              <span className="min-w-0 truncate">{board === "dog" ? dogName : "自分"}</span>
              <span className="inline-flex gap-1" aria-hidden>
                <span className={`size-1.5 rounded-full ${board === "dog" ? "bg-fg" : "bg-fg/30"}`} />
                <span className={`size-1.5 rounded-full ${board === "person" ? "bg-fg" : "bg-fg/30"}`} />
              </span>
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3 pr-3">
            {(board === "dog" ? MENU : PERSON_MENU).map((item) => {
              const body = face(item.Icon, item.label);
              if ("to" in item && item.to === "/dogfriend") {
                return (
                  <Link key={item.key} to="/dogfriend" search={DEFAULT_WALK_SEARCH} className={itemClass}>
                    {body}
                  </Link>
                );
              }
              if ("to" in item) {
                return (
                  <Link key={item.key} to={item.to} className={itemClass}>
                    {body}
                  </Link>
                );
              }
              if (onView) {
                return (
                  <button key={item.key} type="button" className={itemClass} onClick={() => onView(item.view)}>
                    {body}
                  </button>
                );
              }
              return (
                <Link
                  key={item.key}
                  to="/calorie"
                  className={itemClass}
                  onClick={() => {
                    try {
                      sessionStorage.setItem(OPEN_VIEW_KEY, item.view);
                    } catch {
                      /* 保存できなくても画面は開く */
                    }
                  }}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
