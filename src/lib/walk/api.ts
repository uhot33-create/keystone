import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ageFromBirthday, isFutureDate, todayJst } from "./age";
import type { DogBreed, MemoInput, SexValue, WalkMemo } from "./types";

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
  breed_id: string | null;
  breed_name: string | null;
  sex: string | null;
  birthday: unknown;
  age_years: unknown;
  note: string | null;
  last_met_on: unknown;
  rainbow_bridge: unknown;
  rainbow_bridge_on: unknown;
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

function mapMemo(row: MemoRow): WalkMemo {
  return {
    id: row.id,
    name: row.name,
    breedId: row.breed_id,
    breedName: row.breed_name,
    sex: asSex(row.sex),
    birthday: asDate(row.birthday),
    ageYears: intOrNull(row.age_years),
    note: row.note,
    lastMetOn: asDate(row.last_met_on),
    rainbowBridge: Boolean(row.rainbow_bridge),
    rainbowBridgeOn: asDate(row.rainbow_bridge_on),
    imageUrl: row.image_url,
    imagePathname: row.image_pathname,
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
  ["a1000000-0000-4000-8000-000000000017", "北海道犬", 170],
  ["a1000000-0000-4000-8000-000000000018", "コーギー", 180],
  ["a1000000-0000-4000-8000-000000000019", "ボーダーコリー", 190],
  ["a1000000-0000-4000-8000-000000000020", "ゴールデンレトリバー", 200],
  ["a1000000-0000-4000-8000-000000000021", "ラブラドールレトリバー", 210],
  ["a1000000-0000-4000-8000-000000000022", "ドイツシェパード", 220],
  ["a1000000-0000-4000-8000-000000000023", "シベリアンハスキー", 230],
  ["a1000000-0000-4000-8000-000000000024", "サモエド", 240],
  ["a1000000-0000-4000-8000-000000000025", "ミックス", 900],
  ["a1000000-0000-4000-8000-000000000026", "その他", 910],
].map(([id, name, sort]) => ({ id: String(id), name: String(name), sort: Number(sort) }));

async function listBreeds(): Promise<DogBreed[]> {
  const sql = await getSql();
  const count = await sql<{ n: number }>`select count(*)::int as n from dog_breeds`;
  if ((count[0]?.n ?? 0) === 0) {
    for (const breed of BREED_SEED) {
      await sql`
        insert into dog_breeds (id, name, sort_order)
        values (${breed.id}, ${breed.name}, ${breed.sort})
        on conflict (name) do nothing
      `;
    }
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

async function listMemos(userId: string): Promise<WalkMemo[]> {
  const sql = await getSql();
  const rows = await sql<MemoRow>`
    select
      m.id,
      m.name,
      m.breed_id,
      b.name as breed_name,
      m.sex,
      m.birthday,
      m.age_years,
      m.note,
      m.last_met_on,
      m.rainbow_bridge,
      m.rainbow_bridge_on,
      m.image_url,
      m.image_pathname,
      m.created_at,
      m.updated_at
    from memos m
    left join dog_breeds b on b.id = m.breed_id
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
      m.breed_id,
      b.name as breed_name,
      m.sex,
      m.birthday,
      m.age_years,
      m.note,
      m.last_met_on,
      m.rainbow_bridge,
      m.rainbow_bridge_on,
      m.image_url,
      m.image_pathname,
      m.created_at,
      m.updated_at
    from memos m
    left join dog_breeds b on b.id = m.breed_id
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
  breedId: z.string().nullable(),
  sex: z.enum(["オス", "メス", "不明"]).nullable(),
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
  imageUrl: z.string().nullable(),
  imagePathname: z.string().nullable(),
});

async function normalize(input: MemoInput, breeds: DogBreed[]): Promise<MemoInput> {
  const today = todayJst();
  if (input.breedId && !breeds.some((breed) => breed.id === input.breedId)) {
    throw new Error("種類の選択が正しくありません");
  }
  for (const date of [input.birthday, input.lastMetOn, input.rainbowBridgeOn]) {
    if (date && isFutureDate(date, today)) {
      throw new Error("未来の日付は入れられません");
    }
  }
  const birthday = input.birthday;
  const ageYears = birthday ? (ageFromBirthday(birthday, today) ?? input.ageYears) : input.ageYears;
  const rainbowBridgeOn = input.rainbowBridge ? input.rainbowBridgeOn : null;
  return {
    ...input,
    breedId: input.breedId || null,
    sex: input.sex || null,
    ageYears,
    note: input.note.trim(),
    rainbowBridgeOn,
    imageUrl: input.imageUrl || null,
    imagePathname: input.imagePathname || null,
  };
}

export const getWalkState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [breeds, memos] = await Promise.all([listBreeds(), listMemos(context.userId)]);
    return {
      breeds,
      memos,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    };
  });

export const getWalkMemo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const [breeds, memo] = await Promise.all([listBreeds(), getOwned(context.userId, data.id)]);
    if (!memo) throw new Error("カードが見つかりません");
    return {
      breeds,
      memo,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    };
  });

export const createWalkMemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(memoInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const breeds = await listBreeds();
    const next = await normalize(data, breeds);
    const id = crypto.randomUUID();
    await sql`
      insert into memos (
        id, user_id, name, breed_id, sex, birthday, age_years, note,
        last_met_on, rainbow_bridge, rainbow_bridge_on, image_url, image_pathname
      )
      values (
        ${id},
        ${context.userId},
        ${next.name},
        ${next.breedId},
        ${next.sex},
        ${next.birthday},
        ${next.ageYears},
        ${next.note || null},
        ${next.lastMetOn},
        ${next.rainbowBridge},
        ${next.rainbowBridgeOn},
        ${next.imageUrl},
        ${next.imagePathname}
      )
    `;
    const memo = await getOwned(context.userId, id);
    if (!memo) throw new Error("保存できませんでした");
    return memo;
  });

const updateInput = memoInput.extend({
  id: z.string().min(1),
  clearImage: z.boolean(),
});

export const updateWalkMemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(updateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await getOwned(context.userId, data.id);
    if (!current) throw new Error("カードが見つかりません");
    const breeds = await listBreeds();
    const next = await normalize(data, breeds);

    let imageUrl = current.imageUrl;
    let imagePathname = current.imagePathname;
    if (data.clearImage) {
      await removeBlob(current.imageUrl);
      imageUrl = null;
      imagePathname = null;
    } else if (next.imageUrl && next.imageUrl !== current.imageUrl) {
      await removeBlob(current.imageUrl);
      imageUrl = next.imageUrl;
      imagePathname = next.imagePathname;
    }

    await sql`
      update memos
      set
        name = ${next.name},
        breed_id = ${next.breedId},
        sex = ${next.sex},
        birthday = ${next.birthday},
        age_years = ${next.ageYears},
        note = ${next.note || null},
        last_met_on = ${next.lastMetOn},
        rainbow_bridge = ${next.rainbowBridge},
        rainbow_bridge_on = ${next.rainbowBridgeOn},
        image_url = ${imageUrl},
        image_pathname = ${imagePathname},
        updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    const memo = await getOwned(context.userId, data.id);
    if (!memo) throw new Error("保存できませんでした");
    return memo;
  });

export const deleteWalkMemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await getOwned(context.userId, data.id);
    if (!current) throw new Error("カードが見つかりません");
    await removeBlob(current.imageUrl);
    await sql`delete from memos where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });
