/**
 * お散歩カードの新規画面（/dogfriend/new）。
 * フォームは MemoForm。犬種・色は getWalkState で取る。
 * 項目・文字数・画像枚数を変えるなら MemoForm と lib/walk/api.ts。
 * 画像を保存できるかは blobConfigured（Vercel Blob のトークン）。
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MemoForm } from "@/components/walk/memo-form";
import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkState } from "@/lib/walk/api";
import type { DogBreed, DogColor } from "@/lib/walk/types";

/**
 * 新規ルート。保存後の移動は MemoForm が /dogfriend へ行う。
 * パスは /dogfriend/new。中身は WalkNew。項目の規則は MemoForm。
 */
export const Route = createFileRoute("/dogfriend/new")({ component: WalkNew });

/**
 * 犬種と色を読んで MemoForm に渡す。項目の検証はフォーム側。
 * 画面は /dogfriend/new。取得は getWalkState（カード本文は使わない）。
 * 画像を保存できるかは blobConfigured。マスタの中身は api.ts。
 */
function WalkNew() {
  const [breeds, setBreeds] = useState<DogBreed[] | null>(null);
  const [colors, setColors] = useState<DogColor[]>([]);
  const [blobConfigured, setBlobConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * マスタ（犬種・色・画像を保存できるか）を一度取る。カード本文はまだ空。
   * 画面は /dogfriend/new。失敗したら error。アンマウント後の setState は cancelled で捨てる。
   */
  useEffect(() => {
    let cancelled = false;
    getWalkState()
      .then((state) => {
        if (cancelled) return;
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
  }, []);

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <PageHeading title="カードを追加" />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!breeds ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : (
        <MemoForm breeds={breeds} colors={colors} blobConfigured={blobConfigured} />
      )}
    </div>
  );
}
