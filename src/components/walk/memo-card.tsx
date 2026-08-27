import { Link } from "@tanstack/react-router";
import { PawPrint } from "lucide-react";
import { displayAge, formatJaSlashDate } from "@/lib/walk/age";
import type { WalkMemo } from "@/lib/walk/types";

export function MemoCard({ memo }: { memo: WalkMemo }) {
  const age = displayAge(memo);
  const lastMet = formatJaSlashDate(memo.lastMetOn);
  const rainbowOn = formatJaSlashDate(memo.rainbowBridgeOn);
  const meta = [memo.breedName, memo.sex].filter(Boolean).join(" · ");

  return (
    <Link
      to="/walk/$id/edit"
      params={{ id: memo.id }}
      className={[
        "flex flex-col overflow-hidden rounded-xl border shadow-card outline-none transition-[box-shadow,transform] duration-200 ease-[var(--ease-out)] hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring/35 active:scale-[0.99]",
        memo.rainbowBridge ? "border-border bg-surface-2" : "border-border bg-surface",
      ].join(" ")}
    >
      <div className="relative aspect-[4/3] bg-surface-2">
        {memo.imageUrl ? (
          <img src={memo.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-subtle">
            <PawPrint className="size-8" strokeWidth={1.5} />
          </div>
        )}
        {memo.rainbowBridge ? (
          <span className="absolute left-2 top-2 rounded-sm bg-surface/90 px-2 py-1 text-[11px] font-medium tracking-wide text-muted">
            虹の橋
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
        <p className="font-display text-lg font-semibold text-fg">{memo.name}</p>
        {meta ? <p className="text-xs text-muted">{meta}</p> : null}
        {age ? <p className="text-sm text-fg">{age}</p> : null}
        {lastMet ? <p className="text-xs text-muted">最後に会った日: {lastMet}</p> : null}
        {memo.rainbowBridge && rainbowOn ? (
          <p className="text-xs text-muted">{rainbowOn}</p>
        ) : null}
        {memo.note ? (
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{memo.note}</p>
        ) : null}
      </div>
    </Link>
  );
}
