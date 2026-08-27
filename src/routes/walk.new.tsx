import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { MemoForm } from "@/components/walk/memo-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalkState } from "@/lib/walk/api";
import type { DogBreed } from "@/lib/walk/types";
import { DEFAULT_WALK_SEARCH } from "@/lib/walk/types";

export const Route = createFileRoute("/walk/new")({ component: WalkNew });

function WalkNew() {
  const [breeds, setBreeds] = useState<DogBreed[] | null>(null);
  const [blobConfigured, setBlobConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWalkState()
      .then((state) => {
        if (cancelled) return;
        setBreeds(state.breeds);
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
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted" asChild>
        <Link to="/walk" search={DEFAULT_WALK_SEARCH}>
          <ArrowLeft />
          一覧へ戻る
        </Link>
      </Button>
      <div>
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">03</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg">カードを追加</h1>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!breeds ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : (
        <MemoForm breeds={breeds} blobConfigured={blobConfigured} />
      )}
    </div>
  );
}
