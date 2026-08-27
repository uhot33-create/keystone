import { useEffect, useState, type FormEvent } from "react";
import type { DogBreed, WalkSearch } from "@/lib/walk/types";
import { SORT_OPTIONS } from "@/lib/walk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
  const [draftQ, setDraftQ] = useState(search.q);

  useEffect(() => {
    setDraftQ(search.q);
  }, [search.q]);

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
