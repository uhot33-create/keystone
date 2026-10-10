/**
 * 一覧にサムネをあとから合成する。
 * 画面は /walk のカード一覧。文字を先に出し、getWalkThumbs の結果をカバー画像へ載せる。
 * サムネの作り方は image.ts の makeListThumb と api.ts の uploadWalkImage。
 * ここは合成だけ。サイズや画質は変えない。
 */
import type { WalkMemo } from "./types";

/** getWalkThumbs が返す 1 件。カバー画像のサムネだけ。 */
export type WalkThumbPayload = {
  id: string;
  thumbData: string | null;
  thumbUrl: string | null;
  thumbPublic: boolean;
};

/** カバー枠の thumbData / thumbUrl を埋める。ほかのスロットは触らない。 */
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
