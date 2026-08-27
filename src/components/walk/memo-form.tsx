import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { createWalkMemo, deleteWalkMemo, updateWalkMemo } from "@/lib/walk/api";
import { ageFromBirthday, todayJst } from "@/lib/walk/age";
import { compressImage, IMAGE_TARGET_HINT } from "@/lib/walk/image";
import type { ColorValue, DogBreed, SexValue, WalkMemo } from "@/lib/walk/types";
import { COLOR_OPTIONS, DEFAULT_WALK_SEARCH, SEX_OPTIONS } from "@/lib/walk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  name: string;
  breedId: string;
  sex: string;
  color: string;
  birthday: string;
  ageYears: string;
  note: string;
  lastMetOn: string;
  rainbowBridge: boolean;
  rainbowBridgeOn: string;
};

function fromMemo(memo?: WalkMemo | null): Draft {
  return {
    name: memo?.name ?? "",
    breedId: memo?.breedId ?? "",
    sex: memo?.sex ?? "",
    color: memo?.color ?? "",
    birthday: memo?.birthday ?? "",
    ageYears: memo?.ageYears != null ? String(memo.ageYears) : "",
    note: memo?.note ?? "",
    lastMetOn: memo?.lastMetOn ?? "",
    rainbowBridge: memo?.rainbowBridge ?? false,
    rainbowBridgeOn: memo?.rainbowBridgeOn ?? "",
  };
}

export function MemoForm({
  memo,
  breeds,
  blobConfigured,
}: {
  memo?: WalkMemo;
  breeds: DogBreed[];
  blobConfigured: boolean;
}) {
  const navigate = useNavigate();
  const editing = Boolean(memo);
  const [draft, setDraft] = useState<Draft>(() => fromMemo(memo));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(memo?.imageUrl ?? null);
  const [clearImage, setClearImage] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayJst();

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function onBirthday(value: string) {
    const age = value ? ageFromBirthday(value) : null;
    patch({
      birthday: value,
      ageYears: age != null ? String(age) : draft.ageYears,
    });
  }

  async function onPick(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    setError(null);
    try {
      const compressed = await compressImage(picked);
      setFile(compressed);
      setClearImage(false);
      setPreview(URL.createObjectURL(compressed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像を処理できませんでした");
    }
  }

  function onClearImage() {
    setFile(null);
    setPreview(null);
    setClearImage(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      let imageUrl = memo?.imageUrl ?? null;
      let imagePathname = memo?.imagePathname ?? null;
      if (file) {
        if (!blobConfigured) {
          throw new Error("画像の保存には Vercel Blob の設定が必要です");
        }
        const uploaded = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        imageUrl = uploaded.url;
        imagePathname = uploaded.pathname;
      } else if (clearImage) {
        imageUrl = null;
        imagePathname = null;
      }

      const ageRaw = draft.ageYears.trim();
      const payload = {
        name: draft.name,
        breedId: draft.breedId || null,
        sex: (draft.sex || null) as SexValue | null,
        color: (draft.color || null) as ColorValue | null,
        birthday: draft.birthday || null,
        ageYears: ageRaw === "" ? null : Number(ageRaw),
        note: draft.note,
        lastMetOn: draft.lastMetOn || null,
        rainbowBridge: draft.rainbowBridge,
        rainbowBridgeOn: draft.rainbowBridge ? draft.rainbowBridgeOn || null : null,
        imageUrl,
        imagePathname,
      };

      if (memo) {
        await updateWalkMemo({ data: { id: memo.id, clearImage, ...payload } });
      } else {
        await createWalkMemo({ data: payload });
      }
      await navigate({ to: "/walk", search: DEFAULT_WALK_SEARCH });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!memo) return;
    if (!window.confirm(`${memo.name} のカードを削除しますか？`)) return;
    setPending(true);
    setError(null);
    try {
      await deleteWalkMemo({ data: { id: memo.id } });
      await navigate({ to: "/walk", search: DEFAULT_WALK_SEARCH });
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="memo-name">名前</Label>
        <Input
          id="memo-name"
          value={draft.name}
          maxLength={50}
          required
          onChange={(event) => patch({ name: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="memo-breed">種類</Label>
          <Select
            id="memo-breed"
            value={draft.breedId}
            onChange={(event) => patch({ breedId: event.target.value })}
          >
            <option value="">未選択</option>
            {breeds.map((breed) => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="memo-sex">性別</Label>
          <Select
            id="memo-sex"
            value={draft.sex}
            onChange={(event) => patch({ sex: event.target.value })}
          >
            {SEX_OPTIONS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="memo-color">色</Label>
          <Select
            id="memo-color"
            value={draft.color}
            onChange={(event) => patch({ color: event.target.value })}
          >
            {COLOR_OPTIONS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="memo-birthday">生年月日</Label>
          <Input
            id="memo-birthday"
            type="date"
            max={today}
            value={draft.birthday}
            onChange={(event) => onBirthday(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="memo-age">年齢</Label>
          <Input
            id="memo-age"
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            step={1}
            value={draft.ageYears}
            placeholder="歳"
            onChange={(event) => patch({ ageYears: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="memo-last-met">最後に会った日</Label>
        <Input
          id="memo-last-met"
          type="date"
          max={today}
          value={draft.lastMetOn}
          onChange={(event) => patch({ lastMetOn: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="memo-note">メモ</Label>
        <Textarea
          id="memo-note"
          maxLength={2000}
          value={draft.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card">
        <p className="text-sm font-medium text-fg">対象画像</p>
        {preview ? (
          <img src={preview} alt="" className="h-40 w-full rounded-md object-cover" />
        ) : (
          <div className="grid h-40 place-items-center rounded-md bg-surface-2 text-sm text-subtle">
            画像なし
          </div>
        )}
        <p className="text-xs text-muted">
          jpeg / png / webp / heic。端末で縮小してから送ります（{IMAGE_TARGET_HINT}）。
        </p>
        {!blobConfigured ? (
          <p className="text-xs text-muted">
            本番では Vercel Blob（BLOB_READ_WRITE_TOKEN）を設定すると画像を保存できます。
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-border bg-surface px-4 text-sm font-medium shadow-card">
            画像を選択
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              className="sr-only"
              onChange={(event) => {
                void onPick(event.target.files);
                event.target.value = "";
              }}
            />
          </Label>
          {preview ? (
            <Button type="button" variant="outline" onClick={onClearImage} disabled={pending}>
              クリア
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-md bg-surface-2 px-4 py-3">
        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={draft.rainbowBridge}
            onChange={(event) => patch({ rainbowBridge: event.target.checked })}
          />
          虹渡り
        </label>
        {draft.rainbowBridge ? (
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="memo-rainbow-on">虹渡り日</Label>
            <Input
              id="memo-rainbow-on"
              type="date"
              max={today}
              value={draft.rainbowBridgeOn}
              onChange={(event) => patch({ rainbowBridgeOn: event.target.value })}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        <Button type="button" variant="outline" className="flex-1" asChild>
          <Link to="/walk" search={DEFAULT_WALK_SEARCH}>
            キャンセル
          </Link>
        </Button>
      </div>

      {editing ? (
        <Button type="button" variant="outline" disabled={pending} onClick={() => void onDelete()}>
          削除
        </Button>
      ) : null}
    </form>
  );
}
