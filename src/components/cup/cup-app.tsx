/**
 * カップ麺の画面本体。
 * 画面は /cup。タブは在庫・登録・品名。
 * 期限まで30日以内（0日を含む）の在庫カードを強調する。過ぎたものは「期限切れ」。
 * 画像は枠の長押しペーストか「選択」。送信先は /api/cup/image。
 * 品名は100文字まで。個数は0未満にしない。0個の行は残す。
 * 在庫の削除と品名の削除は確認してから。品名を消しても在庫の表示名は残る。
 */
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
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
import { holdCup, peekCup } from "@/lib/cup/held";
import { fileFromImageSrc, imageFileFromClipboard, prepareImageFile } from "@/lib/walk/image";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tab = "stock" | "add" | "items";

/**
 * 今日から期限日までの日数。同じ UTC 日付の差。強調は StockTab で 0〜30。
 * 負なら期限切れ。比較の「今日」は呼び出し側の todayJst（日本時間）。
 */
function daysUntil(expiresOn: string, today: string): number {
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${expiresOn}T00:00:00Z`);
  return Math.floor((to - from) / 86400000);
}

/**
 * タブボタンの見た目。選ばれている方だけ白いカード。
 * 文言（在庫・登録・品名）は CupApp のボタン側。色を変えるときはここ。
 */
function tabClass(active: boolean) {
  return [
    "h-11 rounded-sm text-sm font-medium transition-colors duration-150",
    active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
  ].join(" ");
}

/**
 * Error ならその message、それ以外は決まった文。画面に出すだけ。
 * 文言を変えるときは呼び出し側の fallback。確認ダイアログはここではない。
 */
function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/**
 * 品名画像を /api/cup/image へ送る。縮小は prepareImageFile（おさんぽと同じ 8MB / HEIC）。
 * 返った url と pathname を cup_items に保存する。在庫そのものには画像は付かない。
 */
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

/**
 * 在庫・登録・品名の切替と、保存後の再読込。画面は /cup。
 * タブは tab。品名は items、在庫は stocks。null は未読込。
 * 削除の確認文は下の onDelete。30日強調は StockTab。
 */
export function CupApp() {
  const [tab, setTab] = useState<Tab>("stock");
  // 直前に開いた控え。あれば初回の読み込みを飛ばす（下の useEffect）。
  const cached = peekCup();
  // null はまだ読んでいない。空配列は0件。控えがあればそれを初期値にする。
  const [items, setItems] = useState<CupItem[] | null>(cached?.items ?? null);
  const [stocks, setStocks] = useState<CupStock[] | null>(cached?.stocks ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayJst();

  /**
   * 品名と在庫を取り直して控えも更新する。保存のあとは必ずここ。
   * 並びは期限の早い順（API の getCupState）。画面では並べ替えない。
   */
  async function reload() {
    const next = await getCupState();
    holdCup(next);
    setItems(next.items);
    setStocks(next.stocks);
  }

  // 控えが既にあれば取り直さない。アンマウント後の setState は cancelled で捨てる。
  useEffect(() => {
    if (peekCup()) return;
    let cancelled = false;
    getCupState()
      .then((next) => {
        if (cancelled) return;
        holdCup(next);
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

  /**
   * 変更してから reload。失敗したら在庫の数字はサーバーのまま（画面はエラーだけ）。
   * 確認ではいのあとに呼ぶ。いいえは呼び出し側が return する。
   * 「保存に失敗しました」を変えるときはここの fallback。
   */
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
        <PageHeading title="カップ麺" />
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
          // -1 / +1。結果が0未満なら API が拒否し、行はそのまま残る。
          onAdjust={(id, delta) => run(() => adjustCupStock({ data: { id, delta } }).then(() => undefined))}
          // 確認ではいならその在庫行だけ消す。いいえは何もしない。確認文はここ。
          onDelete={(id) => {
            // いいえなら削除しない。
            if (!window.confirm("この在庫を削除しますか？")) return;
            void run(() => deleteCupStock({ data: { id } }).then(() => undefined));
          }}
          // 編集フォームの保存。品名・期限・個数は StockEditor がまとめて渡す。
          onSave={(input) => run(() => updateCupStock({ data: input }).then(() => undefined))}
        />
      ) : null}
      {items && tab === "add" ? (
        <AddTab
          items={items}
          disabled={busy}
          // 登録後は在庫タブへ戻す。同じ品名でも期限が違えば別行（API はまとめない）。
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
          // 画像があれば先に /api/cup/image。無ければ URL は null。名前の上限は入力の 100。
          onCreate={(input) =>
            run(async () => {
              const image = input.file ? await uploadImage(input.file) : null;
              await addCupItem({
                data: { name: input.name, imageUrl: image?.url ?? null, imagePathname: image?.pathname ?? null },
              });
            })
          }
          // 新しい画像があれば差し替え。外すチェックだけで新画像が無いときだけ clearImage。
          onUpdate={(input) =>
            run(async () => {
              const image = input.file ? await uploadImage(input.file) : null;
              await updateCupItem({
                data: {
                  id: input.id,
                  name: input.name,
                  imageUrl: image?.url,
                  imagePathname: image?.pathname,
                  // 新画像があるときは外さない。外すチェックだけなら true。
                  clearImage: input.clearImage && !image,
                },
              });
            })
          }
          // 確認ではいなら品名マスタだけ消す。在庫の表示名は残る。確認文はここ。
          onDelete={async (item) => {
            const ok = window.confirm(
              "この品名を削除しますか？在庫の表示名は残りますが、品名マスタとのつながりは消えます。",
            );
            // いいえなら品名も在庫もそのまま。
            if (!ok) return;
            await run(() => deleteCupItem({ data: { id: item.id } }).then(() => undefined));
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * 在庫一覧。期限まで 0〜30 日のカードを強調する。過ぎたら「期限切れ」（個数は残る）。
 * -1 / +1 は adjustCupStock。0未満は API が拒否する。削除は行ごと。
 */
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
  // 編集中の在庫。null は一覧だけ。閉じるのは StockEditor。
  const [editing, setEditing] = useState<CupStock | null>(null);
  if (stocks.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">在庫はまだありません。</p>;
  }
  return (
    <>
      <ul className="space-y-2">
        {stocks.map((stock) => {
          // 期限まで30日以内だけ色を変える。過ぎた在庫は消さず「期限切れ」と書く。
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
          // 保存を頼んですぐ編集を閉じる。失敗してもフォームは戻らない（エラーは上）。
          onSave={(input) => {
            onSave(input);
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * 在庫1件の編集。マスタ選択か直接入力。個数は0以上の整数、期限は date 入力。
 * 実在しない日付の拒否は API の assertRealDate。保存先は updateCupStock。
 */
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
  // マスタにつながっていれば「マスタから」。直接入力の在庫は名前を itemName に出す。
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
        // 0未満や整数でない個数は保存しない。画面にエラーは出さない。
        const count = Number(quantity);
        if (!Number.isInteger(count) || count < 0) return;
        onSave({
          id: stock.id,
          // マスタ選択は itemId。直接入力は itemName。両方は送らない。
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

/**
 * 在庫の新規。品名が無ければ最初から直接入力。期限の初期値は日本時間の今日。個数は1。
 * 保存後に親が在庫タブへ戻す。同じ品名でも期限が違えば別の行（まとめて足さない）。
 */
function AddTab({
  items,
  disabled,
  onSave,
}: {
  items: CupItem[];
  disabled: boolean;
  onSave: (input: { itemId: string | null; itemName?: string; expiresOn: string; quantity: number }) => void;
}) {
  // 品名が0件なら最初から直接入力。期限の初期値は日本時間の今日。個数は1。
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
        // 0未満や整数でない個数は登録しない。実在しない日付の拒否は API。
        const count = Number(quantity);
        if (!Number.isInteger(count) || count < 0) return;
        onSave({
          // マスタ選択は itemId。直接入力は itemName。両方は送らない。
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

/**
 * 品名の選び方。在庫の登録と編集で共通。
 * マスタが空なら「マスタから」は押せない。名前は100文字まで（入力の maxLength）。
 * マスタの中身を変えるときは品名タブ。ここは選び方だけ。
 */
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

/**
 * 品名マスタ。追加・編集・削除。画像は任意。
 * 削除しても在庫の item_name は残る。つながり（item_id）だけ切れる、と確認文に書いてある。
 */
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
  // 追加フォームの名前と画像。編集中の1件は editing。null は追加だけ。
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<CupItem | null>(null);

  return (
    <div className="space-y-3">
      {editing ? (
        <ItemEditor
          item={editing}
          disabled={disabled}
          onClose={() => setEditing(null)}
          // 保存を頼んですぐ編集を閉じる。失敗してもフォームは戻らない（エラーは上）。
          onSave={(input) => {
            onUpdate(input);
            setEditing(null);
          }}
        />
      ) : null}
      <form
        className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          // 追加を頼んだあと、入力はすぐ空にする。失敗しても欄は戻らない。
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
    </div>
  );
}

/**
 * 品名1件の編集。新しい画像があれば差し替え、外すチェックだけなら clearImage。
 * 新しいファイルがあるときは親の onUpdate が画像を優先し、clearImage は送らない。
 * 名前は100文字まで。削除の確認は一覧側。
 */
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
  // 新しい画像。外すチェックは clearImage。両方あるときは親が画像を優先する。
  const [file, setFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 編集を開いたら見出しまでスクロールする。別の品名に変えるときは item.id。
  useEffect(() => {
    titleRef.current?.scrollIntoView({ block: "start" });
  }, [item.id]);

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ id: item.id, name, file, clearImage });
      }}
    >
      <h2 ref={titleRef} className="font-display text-2xl font-semibold text-fg">
        品名を編集
      </h2>
      <Input value={name} maxLength={100} required disabled={disabled} onChange={(event) => setName(event.target.value)} />
      {/* 今の画像。外すチェックか、新しいファイルがあるときは出さない。 */}
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

/**
 * 品名画像の貼り付け欄。長押しペーストかファイル選択。プレビューは blob:。
 * 送信は親の uploadImage。ここは File を渡すだけ。
 * 取り方を変えるときは take / onZonePaste / onZoneInput。
 */
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

  // 選んだ File のプレビュー。付け替えとアンマウントで blob: を解放する。
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /**
   * 選んだ1枚を親へ渡す。操作中（disabled）や空は無視。
   * ここで縮小はしない。縮小は uploadImage の prepareImageFile。
   */
  function take(pasted: File | null) {
    if (!pasted || disabled) return;
    setPasteError(null);
    onFile(pasted);
  }

  /**
   * クリップボードに画像があるときだけ貼り付けを止めて取る。
   * 画像でなければブラウザの通常の貼り付けに任せる（return だけ）。
   */
  function onZonePaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = imageFileFromClipboard(event.clipboardData);
    if (!pasted) return;
    event.preventDefault();
    take(pasted);
  }

  /**
   * iPhone の長押しで入った img を File に戻す。枠の中身はすぐ空にする。
   * src が無ければ何もしない。変換失敗は「画像を貼り付けできませんでした」。
   */
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
                // ペーストのショートカットだけ通し、文字入力は枠に残さない。
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
              // 同じファイルを続けて選べるよう、入力は空に戻す。
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
