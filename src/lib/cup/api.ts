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

function asText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

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

function mapItem(row: ItemRow): CupItem {
  return {
    id: String(row.id),
    name: String(row.name),
    hasImage: Boolean(row.image_url),
    createdAt: asText(row.created_at),
  };
}

function mapStock(row: StockRow): CupStock {
  return {
    id: String(row.id),
    itemId: row.item_id == null ? null : String(row.item_id),
    itemName: String(row.item_name),
    expiresOn: asDate(row.expires_on),
    quantity: Number(row.quantity) || 0,
  };
}

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD で入力してください");

function assertRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("存在しない日付です");
  }
}

async function removeBlob(url: string | null) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch {
    // 画像削除に失敗しても、品名の保存は続ける
  }
}

/** 品名一覧（名前順）と在庫一覧（期限の早い順）。 */
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

/** 品名の入力。名前は1〜100文字。画像URLは任意。 */
const itemInput = z.object({
  name: z.string().trim().min(1, "品名は必須です").max(100, "品名は100文字以内で入力してください"),
  imageUrl: z.string().nullable().optional(),
  imagePathname: z.string().nullable().optional(),
  clearImage: z.boolean().optional(),
});

/** 品名を追加する。画像は先にアップロードした URL を渡す。 */
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

/** 品名を更新。画像を差し替えるか外すときは、古い Blob を消す。 */
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
    if (replaceImage && current.image_url && current.image_url !== nextUrl) {
      await removeBlob(current.image_url);
    }
    return { ok: true };
  });

/** 品名を削除。戻り値 referenced は、つながっていた在庫の件数（在庫自体は消さない）。 */
export const deleteCupItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("品名を削除できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
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

/** 在庫の入力。期限は YYYY-MM-DD、個数は0以上の整数。 */
const stockInput = z.object({
  itemId: z.string().uuid().nullable().optional(),
  itemName: z.string().trim().max(100).optional(),
  expiresOn: dateText,
  quantity: z.number().int().min(0, "個数は0以上の整数で入力してください"),
});

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

/** 在庫を1件追加。マスタ選択か、名前の直接入力。 */
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

/** 在庫の品名・期限・個数をまとめて更新。 */
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

/** 個数を delta だけ増減。結果が0未満ならエラー。 */
export const adjustCupStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.string().uuid(), delta: z.number().int().refine((value) => value !== 0) }).safeParse(input);
    if (!parsed.success) throw new Error("個数を変更できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
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

/** 在庫を1件削除。 */
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
