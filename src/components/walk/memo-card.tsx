/**
 * お散歩カード一覧の 1 枚。
 * 画面は /dogfriend。名前タップで編集、肉球で「今日会った」、写真で拡大。
 * 年齢表示は age.ts の displayAge。画像の有無と URL は image.ts。
 * 同じ飼い主の他犬は mates（filter.ts の householdMates）を「ほか」に出す。
 * 一つ前の最後に会った日があれば、その日へ戻すボタンを出す。
 * 虹渡りアイコンと、今日済みの肉球の見た目もここ。
 */
import { Link } from "@tanstack/react-router";
import { PawPrint } from "lucide-react";
import { useState } from "react";
import { displayAge, todayJst } from "@/lib/walk/age";
import { walkMemoHasPhoto, walkMemoImageSrc } from "@/lib/walk/image";
import type { WalkMemo } from "@/lib/walk/types";
import { ImageLightbox } from "@/components/walk/image-lightbox";

/**
 * 虹渡りの印。カード名の横に出す。色の並びを変えるなら path の stroke。
 * 画面は /dogfriend の一覧。フラグは memos.rainbow_bridge。
 * 虹渡り中は肉球を出さない（下の onMetToday の条件）。
 */
function RainbowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-label="虹渡り" role="img">
      <path d="M3 18a9 9 0 0 1 18 0" fill="none" stroke="#e24b4b" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 18a7 7 0 0 1 14 0" fill="none" stroke="#e08a2a" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 18a5 5 0 0 1 10 0" fill="none" stroke="#d4b02a" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 18a3 3 0 0 1 6 0" fill="none" stroke="#4a9a5b" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 18a1 1 0 0 1 2 0" fill="none" stroke="#4a74c4" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * YYYY-MM-DD を 2024/1/2 にする。空や形式違いのときは「—」。最後に会った日と戻す日の両方。
 * 画面は /dogfriend のカード。月日の先頭ゼロは外す。
 * 編集の確認ダイアログは memo-form の formatFollowDate。ゼロ埋めを変えるなら両方。
 */
function formatMet(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const [year, month, day] = value.split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

/**
 * 一覧の 1 行。pending 中は肉球を押せない。onMetToday が無いと肉球は出さない。
 * 画面は /dogfriend。名前は編集へ。写真はライトボックス。年齢は age.ts の displayAge。
 * 肉球の「今日会った」は touchWalkMemoMet。他犬を聞くのは親（一覧）の householdOthers。
 */
export function MemoCard({
  memo,
  mates,
  pending,
  onMetToday,
  onRestoreMet,
}: {
  memo: WalkMemo;
  mates: string[];
  pending?: boolean;
  onMetToday?: (id: string) => void;
  onRestoreMet?: (id: string) => void;
}) {
  const age = displayAge(memo);
  const hasPhoto = walkMemoHasPhoto(memo);
  const imageSrc = walkMemoImageSrc(memo);
  const thumbSrc = walkMemoImageSrc(memo, undefined, "thumb");
  const [open, setOpen] = useState(false);
  // 日本時間の今日（todayJst）と同じなら記録済み。肉球は押せない。
  const metToday = memo.lastMetOn === todayJst();

  return (
    <>
      <article
        className={[
          "flex items-stretch overflow-hidden rounded-xl border shadow-card",
          memo.rainbowBridge ? "border-border bg-surface-2" : "border-border bg-surface",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Link
              to="/dogfriend/$id/edit"
              params={{ id: memo.id }}
              className="min-w-0 truncate font-display text-base font-semibold text-fg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              {memo.name}
            </Link>
            {memo.rainbowBridge ? <RainbowIcon /> : null}
            {/* 虹渡り中は出さない。今日済みは塗りつぶして押せない。このボタンはこの犬だけ。 */}
            {!memo.rainbowBridge && onMetToday ? (
              <button
                type="button"
                className="grid size-7 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-surface-2 disabled:text-primary"
                aria-label={metToday ? "今日会った（記録済）" : "今日会った"}
                disabled={pending || metToday}
                onClick={() => {
                  // このボタンはこの犬だけ。同じ飼い主の他犬は親（一覧の onMetToday）が householdOthers で聞く。
                  // 編集保存で日付が変わったときも memo-form が聞く。すでにその日付の犬は聞かない。
                  if (!window.confirm(`${memo.name} の最後に会った日を今日にしますか？`)) return;
                  onMetToday(memo.id);
                }}
              >
                <PawPrint className="size-3.5" strokeWidth={2} fill={metToday ? "currentColor" : "none"} />
              </button>
            ) : null}
          </div>
          <Link
            to="/dogfriend/$id/edit"
            params={{ id: memo.id }}
            className="mt-0.5 block outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            {memo.ownerName ? (
              <p className="text-xs text-muted">
                飼い主 {memo.ownerName}
                {mates.length > 0 ? `　ほか ${mates.join("・")}` : ""}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted">
              犬種 {memo.breedName || "—"}　年齢 {age || "—"}
              {memo.colorName ? `　色 ${memo.colorName}` : ""}
            </p>
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>最後に会った日 {formatMet(memo.lastMetOn)}</span>
            {/* prevLastMetOn があるときだけ「○に戻す」。中身は restoreWalkMemoMet が日付を入れ替える。 */}
            {memo.prevLastMetOn && onRestoreMet ? (
              <button
                type="button"
                className="font-medium text-primary disabled:opacity-50"
                disabled={pending}
                onClick={() => onRestoreMet(memo.id)}
              >
                {formatMet(memo.prevLastMetOn)}に戻す
              </button>
            ) : null}
          </p>
          <Link
            to="/dogfriend/$id/edit"
            params={{ id: memo.id }}
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{memo.note?.trim() || "—"}</p>
          </Link>
        </div>
        {hasPhoto ? (
          // サムネが無いあいだは「作成中」。拡大は本画像（walkMemoImageSrc の full）。
          <button
            type="button"
            className="flex w-16 shrink-0 flex-col items-center justify-center self-stretch bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            aria-label={thumbSrc ? `${memo.name}の写真` : `${memo.name}の写真を作成中`}
            onClick={() => {
              if (imageSrc) setOpen(true);
            }}
          >
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt=""
                width={64}
                height={80}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-1 text-center text-[10px] leading-tight text-subtle">作成中</span>
            )}
          </button>
        ) : null}
      </article>
      {open && imageSrc ? (
        <ImageLightbox src={imageSrc} alt={`${memo.name}の写真`} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
