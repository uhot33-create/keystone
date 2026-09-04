import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ageFromBirthday, isFutureDate, todayJst } from "./age";
import type { DogBreed, DogColor, MemoImage, MemoInput, SexValue, WalkMemo } from "./types";
import { MAX_MEMO_IMAGES } from "./types";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  }
  return result.data;
}

function asSex(value: string | null): SexValue | null {
  if (value === "オス" || value === "メス" || value === "不明") return value;
  return null;
}

function asDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? "");
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

function intOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

type MemoRow = {
  id: string;
  name: string;
  owner_name: string | null;
  breed_id: string | null;
  breed_name: string | null;
  sex: string | null;
  color_id: string | null;
  color_name: string | null;
  color: string | null;
  birthday: unknown;
  age_years: unknown;
  note: string | null;
  last_met_on: unknown;
  rainbow_bridge: unknown;
  rainbow_bridge_on: unknown;
  images: unknown;
  cover_index: unknown;
  image_url: string | null;
  image_pathname: string | null;
  created_at: unknown;
  updated_at: unknown;
};

type BreedRow = {
  id: string;
  name: string;
  sort_order: unknown;
};

function asImages(value: unknown, fallbackUrl: string | null, fallbackPath: string | null): MemoImage[] {
  const raw = typeof value === "string" ? (() => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  })() : value;
  const fromJson = Array.isArray(raw)
    ? raw.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const rec = item as { url?: unknown; pathname?: unknown };
        const url = typeof rec.url === "string" ? rec.url : "";
        if (!url) return [];
        return [{ url, pathname: typeof rec.pathname === "string" ? rec.pathname : null }];
      })
    : [];
  if (fromJson.length > 0) return fromJson.slice(0, MAX_MEMO_IMAGES);
  if (fallbackUrl) return [{ url: fallbackUrl, pathname: fallbackPath }];
  return [];
}

function asCoverIndex(value: unknown, count: number): number {
  if (count <= 0) return 0;
  const n = intOrNull(value) ?? 0;
  return Math.min(Math.max(0, n), count - 1);
}

function mapMemo(row: MemoRow): WalkMemo {
  const images = asImages(row.images, row.image_url, row.image_pathname);
  const coverIndex = asCoverIndex(row.cover_index, images.length);
  const cover = images[coverIndex] ?? null;
  return {
    id: row.id,
    name: row.name,
    ownerName: row.owner_name?.trim() ? row.owner_name.trim() : null,
    breedId: row.breed_id,
    breedName: row.breed_name,
    sex: asSex(row.sex),
    colorId: row.color_id,
    colorName: row.color_name || row.color,
    birthday: asDate(row.birthday),
    ageYears: intOrNull(row.age_years),
    note: row.note,
    lastMetOn: asDate(row.last_met_on),
    rainbowBridge: Boolean(row.rainbow_bridge),
    rainbowBridgeOn: asDate(row.rainbow_bridge_on),
    images,
    coverIndex,
    imageUrl: cover?.url ?? null,
    imagePathname: cover?.pathname ?? null,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

const BREED_SEED: { id: string; name: string; sort: number }[] = [
  ["a1000000-0000-4000-8000-000000000001", "チワワ", 10],
  ["a1000000-0000-4000-8000-000000000002", "トイプードル", 20],
  ["a1000000-0000-4000-8000-000000000003", "ポメラニアン", 30],
  ["a1000000-0000-4000-8000-000000000004", "ミニチュアダックスフンド", 40],
  ["a1000000-0000-4000-8000-000000000005", "シー・ズー", 50],
  ["a1000000-0000-4000-8000-000000000006", "ヨークシャーテリア", 60],
  ["a1000000-0000-4000-8000-000000000007", "マルチーズ", 70],
  ["a1000000-0000-4000-8000-000000000008", "パピヨン", 80],
  ["a1000000-0000-4000-8000-000000000009", "ペキニーズ", 90],
  ["a1000000-0000-4000-8000-000000000010", "フレンチブルドッグ", 100],
  ["a1000000-0000-4000-8000-000000000011", "パグ", 110],
  ["a1000000-0000-4000-8000-000000000012", "ボストンテリア", 120],
  ["a1000000-0000-4000-8000-000000000013", "キャバリア", 130],
  ["a1000000-0000-4000-8000-000000000014", "ビーグル", 140],
  ["a1000000-0000-4000-8000-000000000015", "柴犬", 150],
  ["a1000000-0000-4000-8000-000000000016", "秋田犬", 160],
  ["a1000000-0000-4000-8000-000000000018", "コーギー", 180],
  ["a1000000-0000-4000-8000-000000000019", "ボーダーコリー", 190],
  ["a1000000-0000-4000-8000-000000000020", "ゴールデンレトリバー", 200],
  ["a1000000-0000-4000-8000-000000000021", "ラブラドールレトリバー", 210],
  ["a1000000-0000-4000-8000-000000000027", "アイリッシュセター", 215],
  ["a1000000-0000-4000-8000-000000000023", "シベリアンハスキー", 230],
  ["a1000000-0000-4000-8000-000000000025", "ミックス", 900],
  ["a1000000-0000-4000-8000-000000000026", "その他", 910],
].map(([id, name, sort]) => ({ id: String(id), name: String(name), sort: Number(sort) }));

async function listBreeds(): Promise<DogBreed[]> {
  const sql = await getSql();
  for (const breed of BREED_SEED) {
    await sql`
      insert into dog_breeds (id, name, sort_order)
      values (${breed.id}, ${breed.name}, ${breed.sort})
      on conflict (name) do nothing
    `;
  }
  const rows = await sql<BreedRow>`
    select id, name, sort_order
    from dog_breeds
    where is_active = true
    order by sort_order asc, name asc
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: intOrNull(row.sort_order) ?? 0,
  }));
}

const COLOR_SEED: { id: string; name: string; sort: number }[] = [
  ["c1000000-0000-4000-8000-000000000001", "白", 10],
  ["c1000000-0000-4000-8000-000000000002", "茶", 20],
  ["c1000000-0000-4000-8000-000000000003", "こげ茶", 30],
  ["c1000000-0000-4000-8000-000000000004", "黒", 40],
  ["c1000000-0000-4000-8000-000000000005", "黒／茶", 50],
].map(([id, name, sort]) => ({ id: String(id), name: String(name), sort: Number(sort) }));

async function listColors(): Promise<DogColor[]> {
  const sql = await getSql();
  const count = await sql<{ n: number }>`select count(*)::int as n from dog_colors`;
  if ((count[0]?.n ?? 0) === 0) {
    for (const color of COLOR_SEED) {
      await sql`
        insert into dog_colors (id, name, sort_order)
        values (${color.id}, ${color.name}, ${color.sort})
        on conflict (name) do nothing
      `;
    }
  }
  const rows = await sql<BreedRow>`
    select id, name, sort_order
    from dog_colors
    where is_active = true
    order by sort_order asc, name asc
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: intOrNull(row.sort_order) ?? 0,
  }));
}

async function listMemos(userId: string): Promise<WalkMemo[]> {
  const sql = await getSql();
  const rows = await sql<MemoRow>`
    select
      m.id,
      m.name,
      m.owner_name,
      m.breed_id,
      b.name as breed_name,
      m.sex,
      m.color_id,
      c.name as color_name,
      m.color,
      m.birthday,
      m.age_years,
      m.note,
      m.last_met_on,
      m.rainbow_bridge,
      m.rainbow_bridge_on,
      m.images,
      m.cover_index,
      m.image_url,
      m.image_pathname,
      m.created_at,
      m.updated_at
    from memos m
    left join dog_breeds b on b.id = m.breed_id
    left join dog_colors c on c.id = m.color_id
    where m.user_id = ${userId}
    order by m.name asc
  `;
  return rows.map(mapMemo);
}

async function getOwned(userId: string, id: string): Promise<WalkMemo | null> {
  const sql = await getSql();
  const rows = await sql<MemoRow>`
    select
      m.id,
      m.name,
      m.owner_name,
      m.breed_id,
      b.name as breed_name,
      m.sex,
      m.color_id,
      c.name as color_name,
      m.color,
      m.birthday,
      m.age_years,
      m.note,
      m.last_met_on,
      m.rainbow_bridge,
      m.rainbow_bridge_on,
      m.images,
      m.cover_index,
      m.image_url,
      m.image_pathname,
      m.created_at,
      m.updated_at
    from memos m
    left join dog_breeds b on b.id = m.breed_id
    left join dog_colors c on c.id = m.color_id
    where m.user_id = ${userId} and m.id = ${id}
    limit 1
  `;
  return rows[0] ? mapMemo(rows[0]) : null;
}

async function removeBlob(url: string | null | undefined) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch {
    // Hobby では削除に失敗してもレコード操作は続ける
  }
}

const optionalDate = z
  .union([z.string(), z.null()])
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value), "日付の形式を確認してください");

const memoInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(50, "名前は50文字以内にしてください"),
  ownerName: z
    .union([z.string(), z.null()])
    .transform((value) => {
      const next = (value ?? "").trim();
      return next.length > 0 ? next : null;
    })
    .refine((value) => value == null || value.length <= 50, "飼い主は50文字以内にしてください"),
  breedId: z.string().nullable(),
  sex: z.enum(["オス", "メス", "不明"]).nullable(),
  colorId: z.string().nullable(),
  birthday: optionalDate,
  ageYears: z
    .number()
    .int("年齢は整数で入力してください")
    .min(0, "年齢は0以上にしてください")
    .max(30, "年齢は30までにしてください")
    .nullable(),
  note: z.string().max(2000, "メモは2000文字以内にしてください"),
  lastMetOn: optionalDate,
  rainbowBridge: z.boolean(),
  rainbowBridgeOn: optionalDate,
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        pathname: z.string().nullable(),
      }),
    )
    .max(MAX_MEMO_IMAGES, "画像は3枚までです"),
  coverIndex: z.number().int().min(0).max(MAX_MEMO_IMAGES - 1),
});

async function normalize(input: MemoInput, breeds: DogBreed[], colors: DogColor[]): Promise<MemoInput> {
  const today = todayJst();
  if (input.breedId && !breeds.some((breed) => breed.id === input.breedId)) {
    throw new Error("種類の選択が正しくありません");
  }
  if (input.colorId && !colors.some((color) => color.id === input.colorId)) {
    throw new Error("色の選択が正しくありません");
  }
  for (const date of [input.birthday, input.lastMetOn, input.rainbowBridgeOn]) {
    if (date && isFutureDate(date, today)) {
      throw new Error("未来の日付は入れられません");
    }
  }
  const birthday = input.birthday;
  const ageYears = birthday ? (ageFromBirthday(birthday, today) ?? input.ageYears) : input.ageYears;
  const rainbowBridgeOn = input.rainbowBridge ? input.rainbowBridgeOn : null;
  const images = input.images.slice(0, MAX_MEMO_IMAGES);
  const coverIndex = images.length === 0 ? 0 : Math.min(Math.max(0, input.coverIndex), images.length - 1);
  return {
    ...input,
    ownerName: input.ownerName?.trim() || null,
    breedId: input.breedId || null,
    sex: input.sex || null,
    colorId: input.colorId || null,
    ageYears,
    note: input.note.trim(),
    rainbowBridgeOn,
    images,
    coverIndex,
  };
}

export const getWalkState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [breeds, colors, memos] = await Promise.all([
      listBreeds(),
      listColors(),
      listMemos(context.userId),
    ]);
    return {
      breeds,
      colors,
      memos,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL),
    };
  });

export const getWalkMemo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const [breeds, colors, memo] = await Promise.all([
      listBreeds(),
      listColors(),
      getOwned(context.userId, data.id),
    ]);
    if (!memo) throw new Error("カードが見つかりません");
    return {
      breeds,
      colors,
      memo,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL),
    };
  });

export const createWalkMemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(memoInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [breeds, colors] = await Promise.all([listBreeds(), listColors()]);
    const next = await normalize(data, breeds, colors);
    const id = crypto.randomUUID();
    const colorName = next.colorId ? colors.find((color) => color.id === next.colorId)?.name ?? null : null;
    const cover = next.images[next.coverIndex] ?? null;
    await sql`
      insert into memos (
        id, user_id, name, owner_name, breed_id, sex, color_id, color, birthday, age_years, note,
        last_met_on, rainbow_bridge, rainbow_bridge_on, images, cover_index, image_url, image_pathname
      )
      values (
        ${id},
        ${context.userId},
        ${next.name},
        ${next.ownerName},
        ${next.breedId},
        ${next.sex},
        ${next.colorId},
        ${colorName},
        ${next.birthday},
        ${next.ageYears},
        ${next.note || null},
        ${next.lastMetOn},
        ${next.rainbowBridge},
        ${next.rainbowBridgeOn},
        ${JSON.stringify(next.images)}::jsonb,
        ${next.coverIndex},
        ${cover?.url ?? null},
        ${cover?.pathname ?? null}
      )
    `;
    const memo = await getOwned(context.userId, id);
    if (!memo) throw new Error("保存できませんでした");
    return memo;
  });

const updateInput = memoInput.extend({
  id: z.string().min(1),
});

export const updateWalkMemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(updateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await getOwned(context.userId, data.id);
    if (!current) throw new Error("カードが見つかりません");
    const [breeds, colors] = await Promise.all([listBreeds(), listColors()]);
    const next = await normalize(data, breeds, colors);
    const keep = new Set(next.images.map((item) => item.url));
    for (const image of current.images) {
      if (!keep.has(image.url)) await removeBlob(image.url);
    }
    const cover = next.images[next.coverIndex] ?? null;

    const colorName = next.colorId ? colors.find((color) => color.id === next.colorId)?.name ?? null : null;

    await sql`
      update memos
      set
        name = ${next.name},
        owner_name = ${next.ownerName},
        breed_id = ${next.breedId},
        sex = ${next.sex},
        color_id = ${next.colorId},
        color = ${colorName},
        birthday = ${next.birthday},
        age_years = ${next.ageYears},
        note = ${next.note || null},
        last_met_on = ${next.lastMetOn},
        rainbow_bridge = ${next.rainbowBridge},
        rainbow_bridge_on = ${next.rainbowBridgeOn},
        images = ${JSON.stringify(next.images)}::jsonb,
        cover_index = ${next.coverIndex},
        image_url = ${cover?.url ?? null},
        image_pathname = ${cover?.pathname ?? null},
        updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    const memo = await getOwned(context.userId, data.id);
    if (!memo) throw new Error("保存できませんでした");
    return memo;
  });

const MAX_B64 = Math.ceil((2.8 * 1024 * 1024 * 4) / 3) + 64;

export const uploadWalkImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(
      z.object({
        type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z
          .string()
          .min(32, "画像を読み込めませんでした")
          .max(MAX_B64, "画像が大きすぎます"),
      }),
      input,
    ),
  )
  .handler(async ({ context, data }) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const buf = Buffer.from(data.base64, "base64");
    if (!buf.length) throw new Error("画像を読み込めませんでした");
    const ext = data.type === "image/png" ? "png" : data.type === "image/webp" ? "webp" : "jpg";
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`walk/${context.userId}/${crypto.randomUUID()}.${ext}`, buf, {
        access: "private",
        contentType: data.type,
        ...(token ? { token } : {}),
      });
      return { url: blob.url, pathname: blob.pathname };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      throw new Error(detail ? `画像を保存できませんでした（${detail}）` : "画像を保存できませんでした");
    }
  });

export const deleteWalkMemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await getOwned(context.userId, data.id);
    if (!current) throw new Error("カードが見つかりません");
    for (const image of current.images) {
      await removeBlob(image.url);
    }
    await sql`delete from memos where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });
