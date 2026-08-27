import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { displayAge } from "@/lib/walk/age";
import { walkMemoImageSrc } from "@/lib/walk/image";
import type { WalkMemo } from "@/lib/walk/types";

export function MemoCard({ memo, mates }: { memo: WalkMemo; mates: string[] }) {
  const age = displayAge(memo);
  const imageSrc = walkMemoImageSrc(memo);
  const [open, setOpen] = useState(false);

  return (
    <>
      <article
        className={[
          "flex overflow-hidden rounded-xl border shadow-card",
          memo.rainbowBridge ? "border-border bg-surface-2" : "border-border bg-surface",
        ].join(" ")}
      >
        <Link
          to="/walk/$id/edit"
          params={{ id: memo.id }}
          className="min-w-0 flex-1 px-4 py-3 outline-none transition-colors duration-200 ease-[var(--ease-out)] hover:bg-surface-2/80 focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <p className="font-display text-base font-semibold text-fg">{memo.name}</p>
          {memo.ownerName ? (
            <p className="mt-0.5 text-xs text-muted">
              飼い主 {memo.ownerName}
              {mates.length > 0 ? `　ほか ${mates.join("・")}` : ""}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted">
            犬種 {memo.breedName || "—"}　年齢 {age || "—"}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{memo.note?.trim() || "—"}</p>
        </Link>
        {imageSrc ? (
          <button
            type="button"
            className="w-20 shrink-0 border-l border-border bg-surface-2 px-2 text-center text-xs font-medium text-fg outline-none transition-colors duration-200 ease-[var(--ease-out)] hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={() => setOpen(true)}
          >
            写真あり
          </button>
        ) : (
          <div className="grid w-20 shrink-0 place-items-center border-l border-border px-2 text-center text-xs text-subtle">
            写真なし
          </div>
        )}
      </article>
      {open && imageSrc ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-fg/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${memo.name}の写真`}
          onClick={() => setOpen(false)}
        >
          <img
            src={imageSrc}
            alt={memo.name}
            className="max-h-[85vh] max-w-full rounded-md bg-surface shadow-card-hover"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
