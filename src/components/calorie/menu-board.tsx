/**
 * 犬の絵をタップすると人の絵とメニューに切り替わる。もう一度タップで犬に戻る。
 * 犬は体重・ごはん・お散歩ログ・通院履歴・おくすり。人は喫煙管理・カップ麺。
 * onView があるとき（わんカロリーの今日画面）は体重・ごはん・おくすりをその場で開く。
 * 無いとき（暮らし帳のカード表示）は /calorie を開き、開く画面を sessionStorage に残す。
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Cigarette, Footprints, Map, Pill, Scale, Soup, Stethoscope, Utensils } from "lucide-react";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

const OPEN_VIEW_KEY = "calorie-open-view";

export type CalorieMenuView = "weight" | "add" | "meds";

/** 暮らし帳から開いたあと、今日画面が一度だけ読む。読んだら消す。 */
export function takeCalorieOpenView(): "home" | CalorieMenuView {
  if (typeof sessionStorage === "undefined") return "home";
  const value = sessionStorage.getItem(OPEN_VIEW_KEY);
  sessionStorage.removeItem(OPEN_VIEW_KEY);
  if (value === "weight" || value === "add" || value === "meds") return value;
  return "home";
}

const MENU = [
  { key: "weight", label: "体重", Icon: Scale, view: "weight" as const },
  { key: "food", label: "ごはん", Icon: Utensils, view: "add" as const },
  { key: "memo", label: "お散歩メモ", Icon: Footprints, to: "/dogfriend" as const },
  { key: "logs", label: "散歩ログ", Icon: Map, to: "/dogwalklogs" as const },
  { key: "vet", label: "通院履歴", Icon: Stethoscope, to: "/vet" as const },
  { key: "meds", label: "おくすり", Icon: Pill, view: "meds" as const },
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
  onView,
}: {
  dogSrc: string;
  dogName: string;
  dogLabel: string;
  onView?: (view: CalorieMenuView) => void;
}) {
  const [board, setBoard] = useState<"dog" | "person">("dog");
  const items = board === "dog" ? MENU : PERSON_MENU;

  return (
    <section className="rounded-sm bg-surface p-1 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_16px_32px_-22px_var(--color-fg)] ring-1 ring-fg/80">
      <div className="rounded-[2px] border border-fg/40 p-1">
        <div className="flex h-[15.5rem] items-stretch gap-3 overflow-hidden border border-fg/15 bg-surface-2">
          <button
            type="button"
            className="relative w-40 shrink-0 cursor-pointer self-stretch overflow-hidden border-r border-fg/20 bg-surface p-0"
            aria-label={board === "dog" ? "人のメニューに切り替え" : "犬のメニューに切り替え"}
            onClick={() => setBoard((current) => (current === "dog" ? "person" : "dog"))}
          >
            <img
              src={board === "dog" ? dogSrc : "/calorie/person.jpg"}
              alt={board === "dog" ? dogName : "人"}
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
            {board === "dog" ? (
              <p className="pointer-events-none absolute inset-x-1 bottom-6 text-center text-[11px] leading-tight text-fg [text-shadow:0_1px_2px_rgba(255,255,255,0.9)]">
                {dogLabel}
              </p>
            ) : null}
            <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-surface/80 py-0.5 text-[11px] leading-tight text-muted">
              <span className="min-w-0 truncate">{board === "dog" ? dogName : "自分"}</span>
              <span className="inline-flex gap-1" aria-hidden>
                <span className={`size-1.5 rounded-full ${board === "dog" ? "bg-fg" : "bg-fg/30"}`} />
                <span className={`size-1.5 rounded-full ${board === "person" ? "bg-fg" : "bg-fg/30"}`} />
              </span>
            </p>
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3 pr-3">
            {items.map((item) => {
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
                      /* 保存できなくてもわんカロリーは開く */
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
