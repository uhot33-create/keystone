/**
 * 人のチェックリスト。画面は /checks。
 * 雛形からリストを作るか、名前だけ作って項目を足す。チェックの履歴は残さない。
 * 項目が1件以上あり、全部チェック済みのリストは日次処理（purgeCheckedLists）で消す。
 * 雛形が1件もない人には、最初だけ「旅行」を入れる。消したあとは戻さない。
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

const TRAVEL_ITEMS = [
  "財布・現金",
  "保険証・身分証",
  "スマホと充電器",
  "鍵",
  "着替え",
  "洗面用具",
  "常備薬",
  "交通系IC",
  "予約の確認",
];

export type CheckTemplate = {
  id: string;
  name: string;
  items: string[];
};

export type CheckItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type CheckList = {
  id: string;
  name: string;
  items: CheckItem[];
};

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  return result.data;
}

function asItems(value: unknown): { label: string; checked?: boolean; id?: string }[] {
  const list = Array.isArray(value) ? value : [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; label?: unknown; checked?: unknown };
    const label = typeof row.label === "string" ? row.label : "";
    if (!label) return [];
    return [{ id: typeof row.id === "string" ? row.id : undefined, label, checked: row.checked === true }];
  });
}

async function seedTravel(sql: Sql, userId: string) {
  const created = await sql<{ id: string }>`
    insert into check_templates (user_id, name, sort_order)
    select ${userId}, ${"旅行"}, 0
    where not exists (select 1 from check_templates where user_id = ${userId})
    returning id
  `;
  const id = created[0]?.id;
  if (!id) return;
  for (const [index, label] of TRAVEL_ITEMS.entries()) {
    await sql`
      insert into check_template_items (template_id, user_id, label, sort_order)
      values (${id}, ${userId}, ${label}, ${index})
    `;
  }
}

async function loadState(sql: Sql, userId: string): Promise<{ templates: CheckTemplate[]; lists: CheckList[] }> {
  await seedTravel(sql, userId);
  const templates = await sql<{ id: string; name: string; items: unknown }>`
    select
      t.id,
      t.name,
      coalesce((
        select json_agg(json_build_object('label', i.label) order by i.sort_order, i.id)
        from check_template_items i
        where i.template_id = t.id
      ), '[]'::json) as items
    from check_templates t
    where t.user_id = ${userId}
    order by t.sort_order, t.created_at
  `;
  const lists = await sql<{ id: string; name: string; items: unknown }>`
    select
      l.id,
      l.name,
      coalesce((
        select json_agg(json_build_object('id', i.id, 'label', i.label, 'checked', i.checked) order by i.sort_order, i.id)
        from check_items i
        where i.list_id = l.id
      ), '[]'::json) as items
    from check_lists l
    where l.user_id = ${userId}
    order by l.created_at desc
  `;
  return {
    templates: templates.map((row) => ({
      id: row.id,
      name: row.name,
      items: asItems(row.items).map((item) => item.label),
    })),
    lists: lists.map((row) => ({
      id: row.id,
      name: row.name,
      items: asItems(row.items).flatMap((item) =>
        item.id ? [{ id: item.id, label: item.label, checked: item.checked === true }] : [],
      ),
    })),
  };
}

/** 雛形と、今あるリスト。雛形が無ければ旅行を1件作る。 */
export const getCheckState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return loadState(sql, context.userId);
  });

const createListInput = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(40, "名前は40文字までです"),
  templateId: z.string().uuid().nullable().optional(),
});

/** リストを作る。雛形があれば項目をコピーする。チェックは全部オフ。 */
export const createCheckList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(createListInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const created = await sql<{ id: string }>`
      insert into check_lists (user_id, name)
      values (${context.userId}, ${data.name})
      returning id
    `;
    const id = created[0]?.id;
    if (!id) throw new Error("リストを作れませんでした");
    if (data.templateId) {
      await sql`
        insert into check_items (list_id, user_id, label, checked, sort_order)
        select ${id}, ${context.userId}, label, false, sort_order
        from check_template_items
        where template_id = ${data.templateId} and user_id = ${context.userId}
        order by sort_order
      `;
    }
    return loadState(sql, context.userId);
  });

const itemInput = z.object({
  listId: z.string().uuid(),
  label: z.string().trim().min(1, "項目を入力してください").max(80, "項目は80文字までです"),
});

/** リストに項目を1件足す。 */
export const addCheckItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(itemInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from check_lists where id = ${data.listId} and user_id = ${context.userId} limit 1
    `;
    if (!owned[0]) throw new Error("リストが見つかりません");
    await sql`
      insert into check_items (list_id, user_id, label, sort_order)
      values (
        ${data.listId},
        ${context.userId},
        ${data.label},
        coalesce((select max(sort_order) + 1 from check_items where list_id = ${data.listId}), 0)
      )
    `;
    return loadState(sql, context.userId);
  });

const toggleInput = z.object({
  id: z.string().uuid(),
  checked: z.boolean(),
});

/** 項目のチェックを付け外しする。履歴は残さない。 */
export const toggleCheckItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(toggleInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update check_items
      set checked = ${data.checked}
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (!updated[0]) throw new Error("項目が見つかりません");
    return loadState(sql, context.userId);
  });

const idInput = z.object({ id: z.string().uuid() });

/** 項目を1件消す。 */
export const deleteCheckItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from check_items where id = ${data.id} and user_id = ${context.userId}`;
    return loadState(sql, context.userId);
  });

/** リストを消す。項目も一緒に消える。 */
export const deleteCheckList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from check_lists where id = ${data.id} and user_id = ${context.userId}`;
    return loadState(sql, context.userId);
  });

const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "雛形の名前を入力してください").max(40, "名前は40文字までです"),
  items: z.array(z.string().trim().min(1).max(80, "項目は80文字までです")).max(40, "項目は40件までです"),
});

/** 雛形を作る、または項目ごと上書きする。空の項目は入れない。 */
export const saveCheckTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(templateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const labels = data.items.map((item) => item.trim()).filter(Boolean);
    let id = data.id;
    if (id) {
      const updated = await sql<{ id: string }>`
        update check_templates
        set name = ${data.name}
        where id = ${id} and user_id = ${context.userId}
        returning id
      `;
      if (!updated[0]) throw new Error("雛形が見つかりません");
      await sql`delete from check_template_items where template_id = ${id} and user_id = ${context.userId}`;
    } else {
      const created = await sql<{ id: string }>`
        insert into check_templates (user_id, name, sort_order)
        values (
          ${context.userId},
          ${data.name},
          coalesce((select max(sort_order) + 1 from check_templates where user_id = ${context.userId}), 0)
        )
        returning id
      `;
      id = created[0]?.id;
      if (!id) throw new Error("雛形を作れませんでした");
    }
    for (const [index, label] of labels.entries()) {
      await sql`
        insert into check_template_items (template_id, user_id, label, sort_order)
        values (${id}, ${context.userId}, ${label}, ${index})
      `;
    }
    return loadState(sql, context.userId);
  });

/** 雛形を消す。すでに作ったリストは残る。 */
export const deleteCheckTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from check_templates where id = ${data.id} and user_id = ${context.userId}`;
    return loadState(sql, context.userId);
  });

/** 項目が1件以上あり、全部チェック済みのリストを消す。日次処理から呼ぶ。 */
export async function purgeCheckedLists(sql: Sql): Promise<{ lists: number }> {
  const rows = await sql<{ id: string }>`
    delete from check_lists
    where id in (
      select list_id
      from check_items
      group by list_id
      having count(*) > 0 and bool_and(checked)
    )
    returning id
  `;
  return { lists: rows.length };
}
