/**
 * お散歩カードの編集画面（/dogfriend/$id/edit）。
 * 保存の中身は MemoForm。このファイルは読み込みと見出しだけ。
 * 対象の id は URL。データは getWalkMemo。見つからないときはエラー文。
 * 項目や画像の上限を変えるなら MemoForm と lib/walk/api.ts。
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MemoForm } from "@/components/walk/memo-form";
import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkMemo } from "@/lib/walk/api";
import type { DogBreed, DogColor, WalkMemo } from "@/lib/walk/types";

/**
 * 編集ルート。中身のコンポーネントは WalkEdit。
 * パスは /dogfriend/$id/edit。id は URL。読み込みは WalkEdit。
 */
export const Route = createFileRoute("/dogfriend/$id/edit")({ component: WalkEdit });

/**
 * URL の id で1件を読む。保存と項目の上限は MemoForm。
 * 画面は /dogfriend/$id/edit。データは getWalkMemo。一覧の控えは使わない。
 * 見つからないときはエラー文。戻る一覧の再取得は、保存・削除で drop したときだけ。
 */
function WalkEdit() {
  const { id } = Route.useParams();
  const [memo, setMemo] = useState<WalkMemo | null>(null);
  const [breeds, setBreeds] = useState<DogBreed[]>([]);
  const [colors, setColors] = useState<DogColor[]>([]);
  const [blobConfigured, setBlobConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * id が変わるたびに getWalkMemo を取り直す。キャッシュは使わない。
   * 画面は編集。他人のカードは API が「見つかりません」。
   * アンマウント後は cancelled で state を更新しない。
   */
  useEffect(() => {
    let cancelled = false;
    getWalkMemo({ data: { id } })
      .then((state) => {
        if (cancelled) return;
        setMemo(state.memo);
        setBreeds(state.breeds);
        setColors(state.colors);
        setBlobConfigured(state.blobConfigured);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <PageHeading title="カードを編集" />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!memo && !error ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : memo ? (
        <MemoForm memo={memo} breeds={breeds} colors={colors} blobConfigured={blobConfigured} />
      ) : null}
    </div>
  );
}
