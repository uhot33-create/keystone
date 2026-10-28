/**
 * お散歩カード一覧の検索バー。
 * 画面は /dogfriend。検索語はボタンを押したときに確定し、URL の search に載る。
 * 並びの選択肢は types.ts の SORT_OPTIONS。犬種はマスタの一覧。
 * 実際に絞り込む処理は filter.ts の filterMemos。ここは入力 UI だけ。
 * 件数は「total件中 shown件」。
 */
import { useEffect, useState, type FormEvent } from "react";
import type { DogBreed, WalkSearch } from "@/lib/walk/types";
import { SORT_OPTIONS } from "@/lib/walk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * 検索・並び・犬種。onChange に次の WalkSearch を渡す。並びと犬種はすぐ反映。
 * 画面は /dogfriend。検索語はボタンまで URL に載らない（draftQ）。
 * 絞り込みの中身は filter.ts。並びの選択肢は types.ts の SORT_OPTIONS。
 */
export function MemoToolbar({
  search,
  breeds,
  total,
  shown,
  onChange,
}: {
  search: WalkSearch;
  breeds: DogBreed[];
  total: number;
  shown: number;
  onChange: (next: WalkSearch) => void;
}) {
  // 入力中の検索語。URL の search.q とは別。検索ボタン（または Enter）で確定する。
  const [draftQ, setDraftQ] = useState(search.q);

  // 戻る・進むで URL の検索語が変わったら、入力欄も合わせる。
  useEffect(() => {
    setDraftQ(search.q);
  }, [search.q]);

  /**
   * 検索ボタン（または Enter）で検索語を確定する。並びと犬種はセレクト変更ですぐ onChange。
   * 画面は /dogfriend の検索バー。前後の空白は trim してから URL の q にする。
   * 検索対象（名前・飼い主など）を変えるなら filter.ts の hay。ここは渡すだけ。
   */
  function onSearch(event: FormEvent) {
    event.preventDefault();
    onChange({ ...search, q: draftQ.trim() });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card">
      <form className="space-y-1.5" onSubmit={onSearch}>
        <Label htmlFor="walk-q">名前・飼い主で探す</Label>
        <div className="flex gap-2">
          <Input
            id="walk-q"
            value={draftQ}
            placeholder="名前や飼い主"
            autoComplete="off"
            onChange={(event) => setDraftQ(event.target.value)}
          />
          <Button type="submit" className="shrink-0">
            検索
          </Button>
        </div>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="walk-sort">並び順</Label>
          <Select
            id="walk-sort"
            value={search.sort}
            onChange={(event) =>
              onChange({ ...search, sort: event.target.value as WalkSearch["sort"] })
            }
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="walk-breed">種類</Label>
          <Select
            id="walk-breed"
            value={search.breed}
            onChange={(event) => onChange({ ...search, breed: event.target.value })}
          >
            <option value="">すべて</option>
            {breeds.map((breed) => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="text-sm text-muted">
        {total}件中 {shown}件
      </p>
    </div>
  );
}
