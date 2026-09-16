import { ensureWalkThumbs } from "./api";
import type { WalkMemo } from "./types";

export function memosNeedingThumbs(memos: WalkMemo[]): WalkMemo[] {
  return memos.filter((memo) =>
    memo.images.some((image) => Boolean(image.url) && !image.thumbPublic),
  );
}

export async function backfillWalkThumbs(
  onMemo: (memo: WalkMemo) => void,
  onRemaining: (remaining: number) => void,
): Promise<void> {
  let errors = 0;
  for (;;) {
    try {
      const next = await ensureWalkThumbs();
      errors = 0;
      if (next.memo) onMemo(next.memo);
      onRemaining(next.remaining);
      if (next.remaining <= 0) return;
    } catch {
      errors += 1;
      if (errors >= 3) {
        onRemaining(0);
        return;
      }
    }
  }
}
