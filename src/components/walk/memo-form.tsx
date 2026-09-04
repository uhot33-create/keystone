import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ClipboardEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { createWalkMemo, deleteWalkMemo, updateWalkMemo, uploadWalkImage } from "@/lib/walk/api";
import { ageFromBirthday, todayJst } from "@/lib/walk/age";
import { fileFromImageSrc, fileToBase64, IMAGE_HINT, imageContentType, imageFileFromClipboard, prepareImageFile, walkMemoImageSrc } from "@/lib/walk/image";
import type { DogBreed, DogColor, SexValue, WalkMemo } from "@/lib/walk/types";
import { DEFAULT_WALK_SEARCH, MAX_MEMO_IMAGES, SEX_OPTIONS } from "@/lib/walk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  name: string;
  ownerName: string;
  breedId: string;
  sex: string;
  colorId: string;
  birthday: string;
  ageYears: string;
  note: string;
  lastMetOn: string;
  rainbowBridge: boolean;
  rainbowBridgeOn: string;
};

type ImageSlot = {
  preview: string | null;
  file: File | null;
  url: string | null;
  pathname: string | null;
};

function emptySlot(): ImageSlot {
  return { preview: null, file: null, url: null, pathname: null };
}

function slotsFromMemo(memo?: WalkMemo | null): ImageSlot[] {
  const images = memo?.images?.length
    ? memo.images
    : memo?.imageUrl
      ? [{ url: memo.imageUrl, pathname: memo.imagePathname }]
      : [];
  const slots: ImageSlot[] = images.map((image, index) => ({
    preview: memo ? walkMemoImageSrc(memo, index) : null,
    file: null,
    url: image.url,
    pathname: image.pathname,
  }));
  while (slots.length < MAX_MEMO_IMAGES) slots.push(emptySlot());
  return slots.slice(0, MAX_MEMO_IMAGES);
}

function fromMemo(memo?: WalkMemo | null): Draft {
  return {
    name: memo?.name ?? "",
    ownerName: memo?.ownerName ?? "",
    breedId: memo?.breedId ?? "",
    sex: memo?.sex ?? "",
    colorId: memo?.colorId ?? "",
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
  colors,
  blobConfigured,
}: {
  memo?: WalkMemo;
  breeds: DogBreed[];
  colors: DogColor[];
  blobConfigured: boolean;
}) {
  const navigate = useNavigate();
  const editing = Boolean(memo);
  const [draft, setDraft] = useState<Draft>(() => fromMemo(memo));
  const [slots, setSlots] = useState<ImageSlot[]>(() => slotsFromMemo(memo));
  const [coverIndex, setCoverIndex] = useState(() => memo?.coverIndex ?? 0);
  const [pending, setPending] = useState<"idle" | "uploading" | "saving">("idle");
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

  async function applyFile(picked: File, slotIndex?: number) {
    const prepared = await prepareImageFile(picked);
    let assigned = -1;
    setSlots((prev) => {
      const next = prev.map((slot) => ({ ...slot }));
      const target =
        slotIndex != null && slotIndex >= 0 && slotIndex < MAX_MEMO_IMAGES
          ? slotIndex
          : next.findIndex((slot) => !slot.preview);
      assigned = target;
      if (target < 0) return prev;
      const current = next[target]!;
      if (current.preview?.startsWith("blob:")) URL.revokeObjectURL(current.preview);
      next[target] = {
        preview: URL.createObjectURL(prepared),
        file: prepared,
        url: null,
        pathname: null,
      };
      return next;
    });
    if (assigned < 0) throw new Error("画像は3枚までです");
  }

  async function onPick(list: FileList | null, slotIndex: number) {
    const picked = list?.[0];
    if (!picked) return;
    setError(null);
    try {
      await applyFile(picked, slotIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像を選べませんでした");
    }
  }

  function onPasteImage(event: ClipboardEvent) {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
    }
    const pasted = imageFileFromClipboard(event.clipboardData);
    if (!pasted) return;
    event.preventDefault();
    setError(null);
    void applyFile(pasted).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "画像を貼り付けできませんでした");
    });
  }

  function onZonePaste(event: ClipboardEvent<HTMLDivElement>, slotIndex: number) {
    const pasted = imageFileFromClipboard(event.clipboardData);
    if (!pasted) return;
    event.preventDefault();
    setError(null);
    void applyFile(pasted, slotIndex).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "画像を貼り付けできませんでした");
    });
  }

  function onZoneInput(event: FormEvent<HTMLDivElement>, slotIndex: number) {
    const root = event.currentTarget;
    const img = root.querySelector("img");
    const src = img?.getAttribute("src") ?? "";
    root.innerHTML = "";
    if (!src) return;
    setError(null);
    void fileFromImageSrc(src)
      .then(async (pasted) => {
        if (pasted) await applyFile(pasted, slotIndex);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "画像を貼り付けできませんでした");
      });
  }

  async function onPasteButton() {
    setError(null);
    try {
      if (navigator.clipboard && "read" in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((value) => value.startsWith("image/"));
          if (!type) continue;
          const blob = await item.getType(type);
          await applyFile(new File([blob], "paste.jpg", { type: blob.type || type, lastModified: Date.now() }));
          return;
        }
      }
      setError("クリップボードに画像がありません。iPhone は枠を長押しして「ペースト」してください");
    } catch {
      setError("この端末ではボタン貼り付けが制限されています。枠を長押しして「ペースト」してください");
    }
  }

  function onClearSlot(slotIndex: number) {
    setSlots((prev) => {
      const next = prev.map((slot) => ({ ...slot }));
      const current = next[slotIndex];
      if (current?.preview?.startsWith("blob:")) URL.revokeObjectURL(current.preview);
      next[slotIndex] = emptySlot();
      return next;
    });
    setCoverIndex((prev) => (prev === slotIndex ? 0 : prev > slotIndex ? prev : prev));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending("saving");
    setError(null);
    try {
      if (!blobConfigured && slots.some((slot) => slot.file)) {
        throw new Error("画像の保存には Vercel Blob の設定が必要です");
      }
      const images: { url: string; pathname: string | null }[] = [];
      const sourceIndexes: number[] = [];
      for (const [index, slot] of slots.entries()) {
        if (slot.file) {
          setPending("uploading");
          const uploaded = await uploadWalkImage({
            data: {
              type: imageContentType(slot.file),
              base64: await fileToBase64(slot.file),
            },
          });
          images.push({ url: uploaded.url, pathname: uploaded.pathname });
          sourceIndexes.push(index);
        } else if (slot.url) {
          images.push({ url: slot.url, pathname: slot.pathname });
          sourceIndexes.push(index);
        }
      }
      setPending("saving");
      const nextCover = Math.max(0, sourceIndexes.indexOf(coverIndex));

      const ageRaw = draft.ageYears.trim();
      const payload = {
        name: draft.name,
        ownerName: draft.ownerName.trim() || null,
        breedId: draft.breedId || null,
        sex: (draft.sex || null) as SexValue | null,
        colorId: draft.colorId || null,
        birthday: draft.birthday || null,
        ageYears: ageRaw === "" ? null : Number(ageRaw),
        note: draft.note,
        lastMetOn: draft.lastMetOn || null,
        rainbowBridge: draft.rainbowBridge,
        rainbowBridgeOn: draft.rainbowBridge ? draft.rainbowBridgeOn || null : null,
        images,
        coverIndex: images.length === 0 ? 0 : nextCover < 0 ? 0 : nextCover,
      };

      if (memo) {
        await updateWalkMemo({ data: { id: memo.id, ...payload } });
      } else {
        await createWalkMemo({ data: payload });
      }
      await navigate({ to: "/walk", search: DEFAULT_WALK_SEARCH });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending("idle");
    }
  }

  async function onDelete() {
    if (!memo) return;
    if (!window.confirm(`${memo.name} のカードを削除しますか？`)) return;
    setPending("saving");
    setError(null);
    try {
      await deleteWalkMemo({ data: { id: memo.id } });
      await navigate({ to: "/walk", search: DEFAULT_WALK_SEARCH });
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
      setPending("idle");
    }
  }

  return (
    <form
      id="walk-memo-form"
      className="flex flex-col gap-5 pb-28"
      onSubmit={onSubmit}
      onPaste={onPasteImage}
    >
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

      <div className="space-y-1.5">
        <Label htmlFor="memo-owner">飼い主</Label>
        <Input
          id="memo-owner"
          value={draft.ownerName}
          maxLength={50}
          placeholder="例: 山田さんち"
          onChange={(event) => patch({ ownerName: event.target.value })}
        />
        <p className="text-xs text-muted">同じ表記にすると、多頭飼いの子がつながって表示されます。</p>
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
            value={draft.colorId}
            onChange={(event) => patch({ colorId: event.target.value })}
          >
            <option value="">未選択</option>
            {colors.map((color) => (
              <option key={color.id} value={color.id}>
                {color.name}
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
        <p className="text-xs text-muted">{IMAGE_HINT}</p>
        {!blobConfigured ? (
          <p className="text-xs text-muted">
            本番では Vercel Blob（BLOB_READ_WRITE_TOKEN）を設定すると画像を保存できます。
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div
                className="relative h-28 overflow-hidden rounded-md bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                tabIndex={0}
              >
                {slot.preview ? (
                  <img src={slot.preview} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center px-1 text-center text-[11px] leading-snug text-subtle">
                    長押しでペースト
                  </div>
                )}
                <div
                  data-image-paste
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label={`画像${index + 1}を貼り付け`}
                  className="absolute inset-0 z-10 caret-transparent text-transparent outline-none"
                  onPaste={(event) => onZonePaste(event, index)}
                  onInput={(event) => onZoneInput(event, index)}
                  onKeyDown={(event) => {
                    if (event.metaKey || event.ctrlKey) return;
                    event.preventDefault();
                  }}
                />
              </div>
              <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-2 text-[11px] font-medium shadow-card">
                選択
                <input
                  type="file"
                  accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  className="sr-only"
                  onChange={(event) => {
                    void onPick(event.target.files, index);
                    event.target.value = "";
                  }}
                />
              </Label>
              {slot.preview ? (
                <button
                  type="button"
                  className="text-[11px] text-muted underline-offset-2 hover:underline"
                  onClick={() => onClearSlot(index)}
                  disabled={pending !== "idle"}
                >
                  クリア
                </button>
              ) : (
                <span className="h-4" />
              )}
              <label className="flex min-h-8 items-start gap-1 text-[11px] leading-snug text-fg">
                <input
                  type="radio"
                  name="cover-image"
                  className="mt-0.5 size-3.5 accent-primary"
                  checked={coverIndex === index}
                  disabled={!slot.preview}
                  onChange={() => setCoverIndex(index)}
                />
                一覧に表示
              </label>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => void onPasteButton()} disabled={pending !== "idle"}>
          貼り付け
        </Button>
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

      {typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface">
              <div className="mx-auto flex max-w-3xl gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" className="flex-1" asChild>
                  <Link to="/walk" search={DEFAULT_WALK_SEARCH}>
                    一覧へ
                  </Link>
                </Button>
                <Button type="submit" form="walk-memo-form" className="flex-1" disabled={pending !== "idle"}>
                  {pending === "uploading" ? "送信中…" : pending === "saving" ? "保存中…" : "保存"}
                </Button>
                <Button type="button" variant="outline" className="flex-1" asChild>
                  <Link to="/walk" search={DEFAULT_WALK_SEARCH}>
                    キャンセル
                  </Link>
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {editing ? (
        <Button type="button" variant="outline" disabled={pending !== "idle"} onClick={() => void onDelete()}>
          削除
        </Button>
      ) : null}
    </form>
  );
}
