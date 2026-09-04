import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { displayAge } from "@/lib/walk/age";
import { walkMemoImageSrc } from "@/lib/walk/image";
import type { WalkMemo } from "@/lib/walk/types";
import { ImageLightbox } from "@/components/walk/image-lightbox";

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

export function MemoCard({ memo, mates }: { memo: WalkMemo; mates: string[] }) {
  const age = displayAge(memo);
  const imageSrc = walkMemoImageSrc(memo);
  const [open, setOpen] = useState(false);

  return (
    <>
      <article
        className={[
          "flex items-stretch overflow-hidden rounded-xl border shadow-card",
          memo.rainbowBridge ? "border-border bg-surface-2" : "border-border bg-surface",
        ].join(" ")}
      >
        <Link
          to="/walk/$id/edit"
          params={{ id: memo.id }}
          className="min-w-0 flex-1 px-4 py-3 outline-none transition-colors duration-200 ease-[var(--ease-out)] hover:bg-surface-2/80 focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 truncate font-display text-base font-semibold text-fg">{memo.name}</p>
            {memo.rainbowBridge ? <RainbowIcon /> : null}
          </div>
          {memo.ownerName ? (
            <p className="mt-0.5 text-xs text-muted">
              飼い主 {memo.ownerName}
              {mates.length > 0 ? `　ほか ${mates.join("・")}` : ""}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted">
            犬種 {memo.breedName || "—"}　年齢 {age || "—"}
            {memo.colorName ? `　色 ${memo.colorName}` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{memo.note?.trim() || "—"}</p>
        </Link>
        {imageSrc ? (
          <button
            type="button"
            className="w-16 shrink-0 self-stretch outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            aria-label={`${memo.name}の写真`}
            onClick={() => setOpen(true)}
          >
            <img src={imageSrc} alt="" className="h-full w-full object-cover" />
          </button>
        ) : null}
      </article>
      {open && imageSrc ? (
        <ImageLightbox src={imageSrc} alt={`${memo.name}の写真`} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
