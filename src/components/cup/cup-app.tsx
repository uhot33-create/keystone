import { useEffect, useState, type ClipboardEvent, type FormEvent } from "react";
import { todayJst } from "@/lib/calorie/formula";
import {
  addCupItem,
  addCupStock,
  adjustCupStock,
  deleteCupItem,
  deleteCupStock,
  getCupState,
  updateCupItem,
  updateCupStock,
  type CupItem,
  type CupStock,
} from "@/lib/cup/api";
import { fileFromImageSrc, imageFileFromClipboard, prepareImageFile } from "@/lib/walk/image";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tab = "stock" | "add" | "items";

function daysUntil(expiresOn: string, today: string): number {
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${expiresOn}T00:00:00Z`);
  return Math.floor((to - from) / 86400000);
}

function tabClass(active: boolean) {
  return [
    "h-11 rounded-sm text-sm font-medium transition-colors duration-150",
    active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
  ].join(" ");
}

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

async function uploadImage(file: File): Promise<{ url: string; pathname: string }> {
  const prepared = await prepareImageFile(file);
  const body = new FormData();
  body.set("file", prepared);
  const response = await fetch("/api/cup/image", { method: "POST", body });
  const json = (await response.json().catch(() => null)) as { url?: string; pathname?: string; error?: string } | null;
  if (!response.ok || !json?.url || !json.pathname) {
    throw new Error(json?.error || "画像を保存できませんでした");
  }
  return { url: json.url, pathname: json.pathname };
}

export function CupApp() {
  const [tab, setTab] = useState<Tab>("stock");
  const [items, setItems] = useState<CupItem[] | null>(null);
  const [stocks, setStocks] = useState<CupStock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayJst();

  async function reload() {
    const next = await getCupState();
    setItems(next.items);
    setStocks(next.stocks);
  }

  useEffect(() => {
    let cancelled = false;
    getCupState()
      .then((next) => {
        if (cancelled) return;
        setItems(next.items);
        setStocks(next.stocks);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, "読み込みに失敗しました"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(work: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await work();
      await reload();
    } catch (err) {
      setError(messageOf(err, "保存に失敗しました"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <BusyOverlay show={items === null || busy} label={items === null ? "読み込み中…" : "保存中…"} />
      <div>
        <h1 className="font-display text-2xl font-semibold text-fg">カップ麺</h1>
        <p className="mt-1 text-xs text-muted">期限が近いものから並びます。30日以内は強調します。</p>
      </div>
      <div className="grid grid-cols-3 rounded-md bg-surface-2 p-1">
        <button type="button" className={tabClass(tab === "stock")} onClick={() => setTab("stock")}>
          在庫
        </button>
        <button type="button" className={tabClass(tab === "add")} onClick={() => setTab("add")}>
          登録
        </button>
        <button type="button" className={tabClass(tab === "items")} onClick={() => setTab("items")}>
          品名
        </button>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {items && stocks && tab === "stock" ? (
        <StockTab
          items={items}
          stocks={stocks}
          today={today}
          disabled={busy}
          onAdjust={(id, delta) => run(() => adjustCupStock({ data: { id, delta } }).then(() => undefined))}
          onDelete={(id) => {
            if (!window.confirm("この在庫を削除しますか？")) return;
            void run(() => deleteCupStock({ data: { id } }).then(() => undefined));
          }}
          onSave={(input) => run(() => updateCupStock({ data: input }).then(() => undefined))}
        />
      ) : null}
      {items && tab === "add" ? (
        <AddTab
          items={items}
          disabled={busy}
          onSave={(input) =>
            run(async () => {
              await addCupStock({ data: input });
              setTab("stock");
            })
          }
        />
      ) : null}
      {items && tab === "items" ? (
        <ItemsTab
          items={items}
          disabled={busy}
          onCreate={(input) =>
            run(async () => {
              const image = input.file ? await uploadImage(input.file) : null;
              await addCupItem({
                data: { name: input.name, imageUrl: image?.url ?? null, imagePathname: image?.pathname ?? null },
              });
            })
          }
          onUpdate={(input) =>
            run(async () => {
              const image = input.file ? await uploadImage(input.file) : null;
              await updateCupItem({
                data: {
                  id: input.id,
                  name: input.name,
                  imageUrl: image?.url,
                  imagePathname: image?.pathname,
                  clearImage: input.clearImage && !image,
                },
              });
            })
          }
          onDelete={async (item) => {
            const ok = window.confirm(
              "この品名を削除しますか？在庫の表示名は残りますが、品名マスタとのつながりは消えます。",
            );
            if (!ok) return;
            await run(() => deleteCupItem({ data: { id: item.id } }).then(() => undefined));
          }}
        />
      ) : null}
    </div>
  );
}

function StockTab({
  items,
  stocks,
  today,
  disabled,
  onAdjust,
  onDelete,
  onSave,
}: {
  items: CupItem[];
  stocks: CupStock[];
  today: string;
  disabled: boolean;
  onAdjust: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onSave: (input: { id: string; itemId: string | null; itemName?: string; expiresOn: string; quantity: number }) => void;
}) {
  const [editing, setEditing] = useState<CupStock | null>(null);
  if (stocks.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">在庫はまだありません。</p>;
  }
  return (
    <>
      <ul className="space-y-2">
        {stocks.map((stock) => {
          const soon = daysUntil(stock.expiresOn, today);
          const highlight = soon >= 0 && soon <= 30;
          return (
            <li
              key={stock.id}
              className={[
                "rounded-xl border p-3",
                highlight ? "border-primary/50 bg-primary/10" : "border-border bg-surface",
              ].join(" ")}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-fg">{stock.itemName}</p>
                  <p className="mt-1 text-xs text-muted">
                    期限: {stock.expiresOn}
                    {soon < 0 ? "　期限切れ" : highlight ? `　あと${soon}日` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold text-fg">{stock.quantity}個</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onAdjust(stock.id, -1)}>
                  -1
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onAdjust(stock.id, 1)}>
                  +1
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setEditing(stock)}>
                  編集
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onDelete(stock.id)}>
                  削除
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing ? (
        <StockEditor
          items={items}
          stock={editing}
          disabled={disabled}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            onSave(input);
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

function StockEditor({
  items,
  stock,
  disabled,
  onClose,
  onSave,
}: {
  items: CupItem[];
  stock: CupStock;
  disabled: boolean;
  onClose: () => void;
  onSave: (input: { id: string; itemId: string | null; itemName?: string; expiresOn: string; quantity: number }) => void;
}) {
  const [mode, setMode] = useState<"select" | "direct">(stock.itemId ? "select" : "direct");
  const [itemId, setItemId] = useState(stock.itemId ?? "");
  const [itemName, setItemName] = useState(stock.itemId ? "" : stock.itemName);
  const [expiresOn, setExpiresOn] = useState(stock.expiresOn);
  const [quantity, setQuantity] = useState(String(stock.quantity));

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        const count = Number(quantity);
        if (!Number.isInteger(count) || count < 0) return;
        onSave({
          id: stock.id,
          itemId: mode === "select" ? itemId || null : null,
          itemName: mode === "direct" ? itemName : undefined,
          expiresOn,
          quantity: count,
        });
      }}
    >
      <p className="text-sm font-semibold text-fg">在庫を編集</p>
      <ItemFields
        items={items}
        mode={mode}
        itemId={itemId}
        itemName={itemName}
        disabled={disabled}
        onMode={setMode}
        onItemId={setItemId}
        onItemName={setItemName}
      />
      <Label className="block space-y-1">
        <span>有効期限</span>
        <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} required disabled={disabled} />
      </Label>
      <Label className="block space-y-1">
        <span>個数</span>
        <Input type="number" min={0} step={1} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={disabled} />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
          閉じる
        </Button>
        <Button type="submit" disabled={disabled}>
          保存
        </Button>
      </div>
    </form>
  );
}

function AddTab({
  items,
  disabled,
  onSave,
}: {
  items: CupItem[];
  disabled: boolean;
  onSave: (input: { itemId: string | null; itemName?: string; expiresOn: string; quantity: number }) => void;
}) {
  const [mode, setMode] = useState<"select" | "direct">(items.length === 0 ? "direct" : "select");
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [expiresOn, setExpiresOn] = useState(todayJst());
  const [quantity, setQuantity] = useState("1");

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        const count = Number(quantity);
        if (!Number.isInteger(count) || count < 0) return;
        onSave({
          itemId: mode === "select" ? itemId || null : null,
          itemName: mode === "direct" ? itemName : undefined,
          expiresOn,
          quantity: count,
        });
      }}
    >
      <ItemFields
        items={items}
        mode={mode}
        itemId={itemId}
        itemName={itemName}
        disabled={disabled}
        onMode={setMode}
        onItemId={setItemId}
        onItemName={setItemName}
      />
      <p className="text-xs text-muted">
        {mode === "select" ? "品名マスタを選んで登録します。" : "入力した名前だけを在庫に残します。"}
      </p>
      <Label className="block space-y-1">
        <span>有効期限</span>
        <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} required disabled={disabled} />
      </Label>
      <Label className="block space-y-1">
        <span>個数</span>
        <Input type="number" min={0} step={1} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={disabled} />
      </Label>
      <Button type="submit" disabled={disabled}>
        登録する
      </Button>
    </form>
  );
}

function ItemFields({
  items,
  mode,
  itemId,
  itemName,
  disabled,
  onMode,
  onItemId,
  onItemName,
}: {
  items: CupItem[];
  mode: "select" | "direct";
  itemId: string;
  itemName: string;
  disabled: boolean;
  onMode: (mode: "select" | "direct") => void;
  onItemId: (id: string) => void;
  onItemName: (name: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={mode === "select" ? "default" : "outline"} disabled={disabled || items.length === 0} onClick={() => onMode("select")}>
          マスタから
        </Button>
        <Button type="button" variant={mode === "direct" ? "default" : "outline"} disabled={disabled} onClick={() => onMode("direct")}>
          直接入力
        </Button>
      </div>
      {mode === "select" ? (
        <select
          className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg"
          value={itemId}
          disabled={disabled}
          onChange={(event) => onItemId(event.target.value)}
          required
        >
          <option value="">品名を選択</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      ) : (
        <Input
          value={itemName}
          maxLength={100}
          placeholder="品名"
          disabled={disabled}
          onChange={(event) => onItemName(event.target.value)}
          required
        />
      )}
    </div>
  );
}

function ItemsTab({
  items,
  disabled,
  onCreate,
  onUpdate,
  onDelete,
}: {
  items: CupItem[];
  disabled: boolean;
  onCreate: (input: { name: string; file: File | null }) => void;
  onUpdate: (input: { id: string; name: string; file: File | null; clearImage: boolean }) => void;
  onDelete: (item: CupItem) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<CupItem | null>(null);

  return (
    <div className="space-y-3">
      <form
        className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate({ name, file });
          setName("");
          setFile(null);
        }}
      >
        <Label className="block space-y-1">
          <span>品名</span>
          <Input value={name} maxLength={100} required disabled={disabled} onChange={(event) => setName(event.target.value)} />
        </Label>
        <ImageField file={file} disabled={disabled} onFile={setFile} />
        <Button type="submit" disabled={disabled}>
          品名を追加
        </Button>
      </form>
      {items.length === 0 ? <p className="py-6 text-center text-sm text-muted">品名マスタはまだありません。</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            {item.hasImage ? (
              <img src={`/api/cup/image?id=${encodeURIComponent(item.id)}`} alt="" className="size-12 rounded-md object-cover" />
            ) : (
              <span className="size-12 rounded-md bg-surface-2" />
            )}
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{item.name}</p>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setEditing(item)}>
              編集
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onDelete(item)}>
              削除
            </Button>
          </li>
        ))}
      </ul>
      {editing ? (
        <ItemEditor
          item={editing}
          disabled={disabled}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            onUpdate(input);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ItemEditor({
  item,
  disabled,
  onClose,
  onSave,
}: {
  item: CupItem;
  disabled: boolean;
  onClose: () => void;
  onSave: (input: { id: string; name: string; file: File | null; clearImage: boolean }) => void;
}) {
  const [name, setName] = useState(item.name);
  const [file, setFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ id: item.id, name, file, clearImage });
      }}
    >
      <p className="text-sm font-semibold text-fg">品名を編集</p>
      <Input value={name} maxLength={100} required disabled={disabled} onChange={(event) => setName(event.target.value)} />
      {item.hasImage && !clearImage && !file ? (
        <img src={`/api/cup/image?id=${encodeURIComponent(item.id)}`} alt="" className="h-24 rounded-md object-cover" />
      ) : null}
      <ImageField file={file} disabled={disabled} onFile={setFile} label="画像を貼り付け・差し替え" />
      {item.hasImage ? (
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={clearImage} disabled={disabled} onChange={(event) => setClearImage(event.target.checked)} />
          画像を外す
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
          閉じる
        </Button>
        <Button type="submit" disabled={disabled}>
          保存
        </Button>
      </div>
    </form>
  );
}

function ImageField({
  file,
  disabled,
  onFile,
  label = "画像（任意）",
}: {
  file: File | null;
  disabled: boolean;
  onFile: (file: File | null) => void;
  label?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function take(pasted: File | null) {
    if (!pasted || disabled) return;
    setPasteError(null);
    onFile(pasted);
  }

  function onZonePaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = imageFileFromClipboard(event.clipboardData);
    if (!pasted) return;
    event.preventDefault();
    take(pasted);
  }

  function onZoneInput(event: FormEvent<HTMLDivElement>) {
    const root = event.currentTarget;
    const img = root.querySelector("img");
    const src = img?.getAttribute("src") ?? "";
    root.innerHTML = "";
    if (!src) return;
    void fileFromImageSrc(src)
      .then((pasted) => {
        if (pasted) take(pasted);
        else setPasteError("画像を貼り付けできませんでした");
      })
      .catch(() => setPasteError("画像を貼り付けできませんでした"));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-fg">{label}</p>
      <div className="relative min-h-40 overflow-hidden rounded-md bg-surface-2">
        {preview ? (
          <img src={preview} alt="" className="max-h-48 w-full object-contain" />
        ) : (
          <>
            <div className="grid min-h-40 place-items-center px-3 text-center text-sm text-subtle">長押しでペースト</div>
            <div
              data-image-paste
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="画像を貼り付け"
              className="absolute inset-0 z-10 caret-transparent text-transparent outline-none"
              onPaste={onZonePaste}
              onInput={onZoneInput}
              onKeyDown={(event) => {
                if (event.metaKey || event.ctrlKey) return;
                event.preventDefault();
              }}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium shadow-card">
          選択
          <input
            type="file"
            accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) take(picked);
              event.target.value = "";
            }}
          />
        </Label>
        {file ? (
          <Button type="button" variant="outline" disabled={disabled} onClick={() => onFile(null)}>
            クリア
          </Button>
        ) : null}
      </div>
      {pasteError ? (
        <p className="text-sm text-danger" role="alert">
          {pasteError}
        </p>
      ) : null}
      <p className="text-xs text-muted">枠を長押ししてペーストするか、選択からファイルを選べます。</p>
    </div>
  );
}
