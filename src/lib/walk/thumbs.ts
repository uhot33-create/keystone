import { ensureWalkThumbs } from "./api";
import type { WalkMemo } from "./types";

export function thumbStats(memos: WalkMemo[]) {
  let photos = 0;
  let ready = 0;
  let skipped = 0;
  let pending = 0;
  for (const memo of memos) {
    for (const image of memo.images) {
      if (!image.url) continue;
      photos += 1;
      if (image.thumbData && image.thumbData.length > 100) ready += 1;
      else pending += 1;
    }
  }
  return { photos, ready, skipped, pending };
}

export function memosNeedingThumbs(memos: WalkMemo[]): WalkMemo[] {
  return memos.filter((memo) =>
    memo.images.some((image) => Boolean(image.url) && !(image.thumbData && image.thumbData.length > 100)),
  );
}

export async function backfillWalkThumbs(
  onMemo: (memo: WalkMemo) => void,
  onRemaining: (remaining: number) => void,
): Promise<void> {
  let errors = 0;
  for (;;) {
    try {
      const skip = errors >= 2;
      const next = await ensureWalkThumbs({ data: { skip } });
      errors = 0;
      if (next.memo) onMemo(next.memo);
      onRemaining(next.remaining);
      if (next.remaining <= 0) return;
    } catch {
      errors += 1;
      if (errors >= 8) {
        onRemaining(0);
        return;
      }
    }
  }
}
