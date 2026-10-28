/**
 * カップ麺の品名と在庫。
 * 画面は /cup。画像の出し入れは /api/cup/image（このファイルは URL を保存するだけ）。
 * 品名は1〜100文字。在庫は期限（実在する YYYY-MM-DD）と0以上の個数。
 * 一覧は期限が近い順。品名を消しても在庫の名前は残り、マスタとのつながりだけ切れる。
 * 画像の実体は Vercel Blob。削除に失敗しても品名の保存は続ける（removeBlob）。
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

/** 品名マスタ1件。hasImage は image_url があるか。 */
export type CupItem = {
  id: string;
  name: string;
  hasImage: boolean;
  createdAt: string;
};

/** 在庫1件。itemId が null なら直接入力の名前だけ。 */
export type CupStock = {
  id: string;
  itemId: string | null;
  itemName: string;
  expiresOn: string;
  quantity: number;
};

type ItemRow = {
  id: unknown;
  name: unknown;
  image_url: unknown;
  created_at: unknown;
};

type StockRow = {
  id: unknown;
  item_id: unknown;
  item_name: unknown;
  expires_on: unknown;
  quantity: unknown;
};

/**
 * 日付以外の文字列化。品名の createdAt 用。
 * Date なら ISO の先頭10文字。画面の期限比較には asDate を使う。
 */
function asText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

/**
 * 在庫の期限を YYYY-MM-DD にする。Date は UTC の年月日（日付型をずらさない）。
 * 「今日」の比較は画面の todayJst。ここでは保存値を切るだけ。
 */
function asDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(value ?? "");
  return text.slice(0, 10);
}

/**
 * cup_items の1行。画像の有無だけ返し、URL 自体は画面へ出さない。
 * 画像の表示は /api/cup/image。hasImage の条件を変えるときは image_url。
 */
function mapItem(row: ItemRow): CupItem {
  return {
    id: String(row.id),
    name: String(row.name),
    hasImage: Boolean(row.image_url),
    createdAt: asText(row.created_at),
  };
}

/**
 * cup_stocks の1行。itemId が null はマスタに繋がっていない直接入力。
 * 個数が壊れていたら 0。期限の形は asDate。並び順は getCupState。
 */
function mapStock(row: StockRow): CupStock {
  return {
    id: String(row.id),
    itemId: row.item_id == null ? null : String(row.item_id),
    itemName: String(row.item_name),
    expiresOn: asDate(row.expires_on),
    quantity: Number(row.quantity) || 0,
  };
}

/** 期限の形だけ。実在するかは assertRealDate。文言を変えるときはこのメッセージ。 */
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD で入力してください");

/**
 * 2月31日などを拒否する。比較は UTC で作り直して、入力と同じ年月日か見る。
 * 在庫の追加と更新の validator から呼ぶ。メッセージは「存在しない日付です」。
 */
function assertRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    // 作り直した年月日が入力と違うときだけ拒否（2月31日など）。
    throw new Error("存在しない日付です");
  }
}

/**
 * 品名画像の Blob を消す。トークンが無い、失敗しても品名の保存は続ける。
 * 呼び出しは updateCupItem と deleteCupItem。在庫削除では呼ばない。
 */
async function removeBlob(url: string | null) {
  // トークンが無い環境では消さない。品名の行の更新は呼び出し側が続ける。
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch {
    // 画像削除に失敗しても、品名の保存は続ける
  }
}

/**
 * 品名一覧（名前順）と在庫一覧（期限の早い順、同日は作成順）。
 * どちらもログイン中の user_id だけ。在庫の個数と期限のルールは stockInput。画面の30日強調はここではない。
 */
export const getCupState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const items = await sql<ItemRow>`
      select id, name, image_url, created_at
      from cup_items
      where user_id = ${context.userId}
      order by name asc
    `;
    const stocks = await sql<StockRow>`
      select id, item_id, item_name, expires_on, quantity
      from cup_stocks
      where user_id = ${context.userId}
      order by expires_on asc, created_at asc
    `;
    return { items: items.map(mapItem), stocks: stocks.map(mapStock) };
  });

/**
 * 品名の入力。名前は1〜100文字。画像URLは任意。
 * 文言を変えるときはこの schema。clearImage は更新のときだけ見る。
 */
const itemInput = z.object({
  name: z.string().trim().min(1, "品名は必須です").max(100, "品名は100文字以内で入力してください"),
  imageUrl: z.string().nullable().optional(),
  imagePathname: z.string().nullable().optional(),
  clearImage: z.boolean().optional(),
});

/**
 * 品名を追加する。画像は先にアップロードした URL を渡す。
 * 画面の品名タブ。名前の上限は itemInput（100）。画像が無いときは null。
 */
export const addCupItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = itemInput.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "品名を保存できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into cup_items (user_id, name, image_url, image_pathname)
      values (
        ${context.userId},
        ${data.name},
        ${data.imageUrl ?? null},
        ${data.imagePathname ?? null}
      )
    `;
    return { ok: true };
  });

/**
 * 品名を更新。画像を差し替えるか外すときは、古い Blob を消す。
 * clearImage なら URL を null。新しい URL なら差し替え。どちらでもなければ今の画像。
 * 名前の上限は itemInput。他人の id は「品名が見つかりません」。
 */
export const updateCupItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = itemInput.extend({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "品名を更新できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ image_url: string | null; image_pathname: string | null }>`
      select image_url, image_pathname from cup_items
      where id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    const current = rows[0];
    if (!current) throw new Error("品名が見つかりません");
    // clearImage なら外す。新しい URL なら差し替え。どちらでもなければ今の画像を残す。
    const replaceImage = Boolean(data.clearImage) || data.imageUrl != null;
    const nextUrl = data.clearImage ? null : data.imageUrl != null ? data.imageUrl : current.image_url;
    const nextPath = data.clearImage ? null : data.imageUrl != null ? (data.imagePathname ?? null) : current.image_pathname;
    await sql`
      update cup_items
      set
        name = ${data.name},
        image_url = ${nextUrl},
        image_pathname = ${nextPath}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    // 外したか別 URL にしたときだけ古い Blob を消す。同じ URL なら消さない。
    if (replaceImage && current.image_url && current.image_url !== nextUrl) {
      await removeBlob(current.image_url);
    }
    return { ok: true };
  });

/**
 * 品名を削除。戻り値 referenced は、つながっていた在庫の件数（在庫自体は消さない）。
 * 在庫の item_id は外部キーの set null で切れる。表示名 item_name は残る。
 * 確認文は画面。画像の Blob は removeBlob。
 */
export const deleteCupItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("品名を削除できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // 削除前に数える。在庫行は delete していない（item_id だけあとで null になる）。
    const counts = await sql<{ count: number }>`
      select count(*)::int as count
      from cup_stocks
      where user_id = ${context.userId} and item_id = ${data.id}
    `;
    const rows = await sql<{ image_url: string | null }>`
      delete from cup_items
      where id = ${data.id} and user_id = ${context.userId}
      returning image_url
    `;
    if (!rows[0]) throw new Error("品名が見つかりません");
    await removeBlob(rows[0].image_url);
    return { referenced: Number(counts[0]?.count) || 0 };
  });

/**
 * 在庫の入力。期限は YYYY-MM-DD、個数は0以上の整数。
 * 実在する日付かは assertRealDate。0個も保存できる。消すのは deleteCupStock。
 */
const stockInput = z.object({
  itemId: z.string().uuid().nullable().optional(),
  itemName: z.string().trim().max(100).optional(),
  expiresOn: dateText,
  quantity: z.number().int().min(0, "個数は0以上の整数で入力してください"),
});

/**
 * 在庫の品名を決める。itemId があれば自分の cup_items の名前を使う（他人の id は拒否）。
 * 無ければ直接入力。空は「品名を選択するか、直接入力してください」。
 */
async function resolveItem(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  itemId: string | null | undefined,
  itemName: string | undefined,
) {
  if (itemId) {
    const rows = await sql<{ id: string; name: string }>`
      select id, name from cup_items
      where id = ${itemId} and user_id = ${userId}
      limit 1
    `;
    const item = rows[0];
    if (!item) throw new Error("指定された品名マスタが存在しません");
    return { itemId: item.id, itemName: item.name };
  }
  const name = itemName?.trim() ?? "";
  if (!name) throw new Error("品名を選択するか、直接入力してください");
  return { itemId: null, itemName: name };
}

/**
 * 在庫を1件追加。マスタ選択か、名前の直接入力。
 * 同じ品名でも期限が違えば別行。まとめない。期限の実在は assertRealDate。
 * 品名の決め方を変えるときは resolveItem。
 */
export const addCupStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = stockInput.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "在庫を登録できませんでした");
    assertRealDate(parsed.data.expiresOn);
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const item = await resolveItem(sql, context.userId, data.itemId, data.itemName);
    await sql`
      insert into cup_stocks (user_id, item_id, item_name, expires_on, quantity)
      values (${context.userId}, ${item.itemId}, ${item.itemName}, ${data.expiresOn}, ${data.quantity})
    `;
    return { ok: true };
  });

/**
 * 在庫の品名・期限・個数をまとめて更新。
 * 画面の在庫編集。個数の -1/+1 はここではなく adjustCupStock。
 * 見つからなければ「在庫が見つかりません」。期限は assertRealDate。
 */
export const updateCupStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = stockInput.extend({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "在庫を更新できませんでした");
    assertRealDate(parsed.data.expiresOn);
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const item = await resolveItem(sql, context.userId, data.itemId, data.itemName);
    const rows = await sql<{ id: string }>`
      update cup_stocks
      set
        item_id = ${item.itemId},
        item_name = ${item.itemName},
        expires_on = ${data.expiresOn},
        quantity = ${data.quantity},
        updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) throw new Error("在庫が見つかりません");
    return { ok: true };
  });

/**
 * 個数を delta だけ増減。結果が0未満ならエラー（行を更新しない）。
 * 自分の user_id の在庫だけ。0個の行は残る。消すのは deleteCupStock。
 */
export const adjustCupStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.string().uuid(), delta: z.number().int().refine((value) => value !== 0) }).safeParse(input);
    if (!parsed.success) throw new Error("個数を変更できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // 0未満になる更新は where に合わず行が残る。0個は消えない。消すのは deleteCupStock。
    const rows = await sql<{ quantity: number }>`
      update cup_stocks
      set quantity = quantity + ${data.delta}, updated_at = now()
      where id = ${data.id}
        and user_id = ${context.userId}
        and quantity + ${data.delta} >= 0
      returning quantity
    `;
    if (!rows[0]) throw new Error("個数は0未満にできません");
    return { quantity: Number(rows[0].quantity) };
  });

/**
 * 在庫を1件削除。確認文は画面の在庫カード。
 * 自分の user_id だけ。品名マスタと画像は消さない。
 */
export const deleteCupStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("在庫を削除できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      delete from cup_stocks
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) throw new Error("在庫が見つかりません");
    return { ok: true };
  });
