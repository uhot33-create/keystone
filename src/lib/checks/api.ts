/**
 * 人のチェックリスト。画面は /checks。
 * 雛形からリストを作るか、名前だけ作って項目を足す。チェックの履歴は残さない。
 * 開いたリストのチェックと項目は、保存ボタンでまとめて書き込む。
 * 項目が1件以上あり、全部チェック済みのリストは日次処理（purgeCheckedLists）で消す。
 * 雛形が1件もない人には、最初だけ「旅行」を入れる。消したあとは戻さない。
 * 実装は seedTravel。雛形が0件だと次の読み込みでまた入る。止めるならそこ。
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

// 雛形が0件の人に入れる「旅行」の項目。文を変えても、すでに入っている人には足さない。
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

/**
 * zod の入力チェック。失敗したら最初のメッセージを投げる。
 * 画面の各 API は validator からここを通る。文言は各 schema 側。
 */
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  return result.data;
}

/**
 * JSON の項目配列を label 付きの行にする。
 * オブジェクトでない行と、空の label は捨てる。checked は true のときだけ true。
 * 雛形は label だけ、リストは id も使う（loadState）。
 */
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

/**
 * 雛形が1件もないときだけ「旅行」を入れる。loadState のたびに見る。
 * 条件は check_templates が0件（not exists）。全部消すと次の読み込みでまた入る。
 * 戻したくないならこの insert の条件を変える。項目の文は TRAVEL_ITEMS。名前は「旅行」。
 */
async function seedTravel(sql: Sql, userId: string) {
  const created = await sql<{ id: string }>`
    insert into check_templates (user_id, name, sort_order)
    select ${userId}, ${"旅行"}, 0
    where not exists (select 1 from check_templates where user_id = ${userId})
    returning id
  `;
  const id = created[0]?.id;
  // すでに雛形がある（returning が空）なら項目は足さない。
  if (!id) return;
  for (const [index, label] of TRAVEL_ITEMS.entries()) {
    await sql`
      insert into check_template_items (template_id, user_id, label, sort_order)
      values (${id}, ${userId}, ${label}, ${index})
    `;
  }
}

/**
 * この人の雛形とリストを読む。先に seedTravel。
 * 雛形は sort_order 順、リストは新しい順。項目は sort_order 順。
 * 並びを変えるときはここの order by。画面は getCheckState からこれを使う。
 */
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

/**
 * 雛形と、今あるリスト。画面 /checks の初回読み込み。
 * 雛形が無ければ seedTravel が「旅行」を1件作る。
 * 返す形を変えるときは loadState。
 */
export const getCheckState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return loadState(sql, context.userId);
  });

/** リスト作成。名前は1〜40文字。雛形 id は無くてもよい。 */
const createListInput = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(40, "名前は40文字までです"),
  templateId: z.string().uuid().nullable().optional(),
});

/**
 * リストを作る。雛形があれば項目をコピーする。チェックは全部オフ。
 * 画面の「作る」から。名前の上限は createListInput。
 * コピーの checked を変えるときは下の insert の false。
 */
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
    // 雛形ありのときだけ項目をコピー。checked は false。済みでコピーしたいときはこの false。
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

/** リスト保存。項目は100件まで、各ラベル1〜80文字。全部済みの削除は画面側で、ここは残す保存。 */
const saveListInput = z.object({
  id: z.string().uuid(),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1, "項目を入力してください").max(80, "項目は80文字までです"),
        checked: z.boolean(),
      }),
    )
    .max(100, "項目は100件までです"),
});

/**
 * 開いているリストの項目を、今の並びとチェックでまとめて入れ直す。
 * 差分ではなく、一度全部消してから insert する。空配列なら項目ゼロのリストが残る。
 * 件数の上限は saveListInput（100）。他人のリストは「リストが見つかりません」。
 */
export const saveCheckList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(saveListInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from check_lists where id = ${data.id} and user_id = ${context.userId} limit 1
    `;
    if (!owned[0]) throw new Error("リストが見つかりません");
    // 差分更新ではない。このリストの項目を消して、draft の順で入れ直す。
    await sql`delete from check_items where list_id = ${data.id} and user_id = ${context.userId}`;
    for (const [index, item] of data.items.entries()) {
      await sql`
        insert into check_items (list_id, user_id, label, checked, sort_order)
        values (${data.id}, ${context.userId}, ${item.label}, ${item.checked}, ${index})
      `;
    }
    return loadState(sql, context.userId);
  });

const idInput = z.object({ id: z.string().uuid() });

/**
 * リストを消す。項目も一緒に消える（テーブルの cascade）。
 * 画面の「このリストを削除」と、全部チェック済みの保存確認からはいのとき。
 * 確認文は画面側。ここは id が自分のもののときだけ消す。
 */
export const deleteCheckList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from check_lists where id = ${data.id} and user_id = ${context.userId}`;
    return loadState(sql, context.userId);
  });

/** 雛形の保存。名前1〜40文字。項目は40件まで、各1〜80文字。id があれば更新。 */
const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "雛形の名前を入力してください").max(40, "名前は40文字までです"),
  items: z.array(z.string().trim().min(1).max(80, "項目は80文字までです")).max(40, "項目は40件までです"),
});

/**
 * 雛形を作る、または項目ごと上書きする。空の項目は入れない。
 * id ありは名前の更新と項目の入れ直し。無しは新規（sort_order は最大+1）。
 * 上限を変えるときは templateInput。画面は雛形タブの登録／更新。
 */
export const saveCheckTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(templateInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const labels = data.items.map((item) => item.trim()).filter(Boolean);
    let id = data.id;
    if (id) {
      // 既存雛形。名前を更新し、項目は一度消して入れ直す。見つからなければエラー。
      const updated = await sql<{ id: string }>`
        update check_templates
        set name = ${data.name}
        where id = ${id} and user_id = ${context.userId}
        returning id
      `;
      if (!updated[0]) throw new Error("雛形が見つかりません");
      await sql`delete from check_template_items where template_id = ${id} and user_id = ${context.userId}`;
    } else {
      // id なしは新規。並びは今の最大 sort_order の次。
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

/**
 * 雛形を消す。すでに作ったリストは残る（リストはコピーで、雛形を参照しない）。
 * 確認文は画面の雛形タブ。ここは自分の id だけ消す。
 */
export const deleteCheckTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(idInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from check_templates where id = ${data.id} and user_id = ${context.userId}`;
    return loadState(sql, context.userId);
  });

/**
 * 項目が1件以上あり、全部チェック済みのリストを消す。日次処理から呼ぶ。
 * 条件は count>0 かつ全部 checked。項目ゼロのリストは残る。
 * 画面の保存確認とは別。空リストを消したくないなら having を変える。
 */
export async function purgeCheckedLists(sql: Sql): Promise<{ lists: number }> {
  // count>0 かつ bool_and(checked) のリストだけ。項目が無いリストはサブクエリに出ない。
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
