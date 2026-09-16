import { attachWalkThumb } from "./api";
import { fileToBase64, makeListThumb, walkMemoImageSrc } from "./image";
import type { WalkMemo } from "./types";

export function memosNeedingThumbs(memos: WalkMemo[]): WalkMemo[] {
  return memos.filter((memo) =>
    (memo.images.length > 0 ? memo.images : memo.imageUrl ? [{ url: memo.imageUrl, thumbUrl: null }] : []).some(
      (image) => Boolean(image.url || memo.imageUrl) && !image.thumbUrl,
    ),
  );
}

export async function backfillWalkThumbs(
  memos: WalkMemo[],
  onMemo: (memo: WalkMemo) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (const memo of memosNeedingThumbs(memos)) {
    const count = memo.images.length || (memo.imageUrl ? 1 : 0);
    for (let index = 0; index < count; index += 1) {
      if (signal?.aborted) return;
      const image = memo.images[index];
      if (image?.thumbUrl) continue;
      const src = walkMemoImageSrc(memo, index, "full");
      if (!src) continue;
      try {
        const res = await fetch(src, { signal });
        if (!res.ok) continue;
        const blob = await res.blob();
        const file = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
        const thumb = await makeListThumb(file);
        const next = await attachWalkThumb({
          data: { id: memo.id, index, thumbBase64: await fileToBase64(thumb) },
        });
        onMemo(next);
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
  }
}
