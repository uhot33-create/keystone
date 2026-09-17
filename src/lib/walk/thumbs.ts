import type { WalkMemo } from "./types";

export type WalkThumbPayload = {
  id: string;
  thumbData: string | null;
  thumbUrl: string | null;
  thumbPublic: boolean;
};

export function applyWalkThumbs(memos: WalkMemo[], thumbs: WalkThumbPayload[]): WalkMemo[] {
  if (thumbs.length === 0) return memos;
  const byId = new Map(thumbs.map((item) => [item.id, item]));
  return memos.map((memo) => {
    const thumb = byId.get(memo.id);
    if (!thumb) return memo;
    if (memo.images.length === 0) return memo;
    const cover = Math.min(memo.coverIndex, memo.images.length - 1);
    return {
      ...memo,
      images: memo.images.map((image, index) =>
        index === cover
          ? {
              ...image,
              thumbData: thumb.thumbData ?? image.thumbData,
              thumbUrl: thumb.thumbUrl ?? image.thumbUrl,
              thumbPublic: thumb.thumbPublic || image.thumbPublic,
            }
          : image,
      ),
    };
  });
}
