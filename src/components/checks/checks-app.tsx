/**
 * 人のチェックリスト画面。
 * リストの作成、雛形からのコピー。チェックと項目の追加・削除は保存まで画面だけ。
 * 保存時に全部チェック済みなら、リストを消すか確認する。いいえなら保存も削除もしない。
 * 保存していない変更を一覧へ戻すときは、捨てるか確認する。履歴は出さない。
 * 全部チェックしたまま残したリストは、日次処理で消える。
 */
import { useEffect, useState, type FormEvent } from "react";
import {
  createCheckList,
  deleteCheckList,
  deleteCheckTemplate,
  getCheckState,
  saveCheckList,
  saveCheckTemplate,
  type CheckList,
  type CheckTemplate,
} from "@/lib/checks/api";
import { PageHeading } from "@/components/page-heading";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type View = "lists" | "templates";

type DraftItem = {
  key: string;
  label: string;
  checked: boolean;
};

/**
 * 失敗を画面の一文にする。
 * Error ならその message、それ以外は呼び出し側の fallback。
 * 確認ダイアログの文はここではない（closeList と onSaveList、削除ボタン）。
 */
function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/**
 * チェック済みの件数。
 * 詳細は draft、一覧カードは保存済みの items。
 * 「全部済み」は件数が1以上かつこの数と長さが同じ。空リストは全部済みにしない。
 */
function doneCount(items: { checked: boolean }[]) {
  return items.filter((item) => item.checked).length;
}

/**
 * 保存済みリストを、画面の編集用 draft に写す。
 * key は項目 id。新規行の key は onAddItem が付ける。
 * チェック変更は setDraft だけで、保存まで DB は動かない。
 */
function draftFrom(list: CheckList): DraftItem[] {
  return list.items.map((item) => ({ key: item.id, label: item.label, checked: item.checked }));
}

/**
 * 保存済みリストと draft が違うか。
 * 件数、項目の文、チェックのどれかが違えば未保存。
 * 保存ボタンを押せる条件を変えるときはここ。
 */
function isDirty(list: CheckList, draft: DraftItem[]) {
  if (list.items.length !== draft.length) return true;
  return draft.some((item, index) => item.label !== list.items[index]?.label || item.checked !== list.items[index]?.checked);
}

/**
 * リストと雛形の画面。開いているリストの編集は draft。保存するまで DB は変えない。
 * view が lists なら一覧、templates なら雛形。openId があると詳細。
 * 全部済みで消すかは onSaveList。閉じる確認は closeList。
 */
export function ChecksApp() {
  const [view, setView] = useState<View>("lists");
  // null はまだ読んでいない（読み込み中）。空配列は0件。
  const [templates, setTemplates] = useState<CheckTemplate[] | null>(null);
  const [lists, setLists] = useState<CheckList[] | null>(null);
  // 詳細で開いているリストの id。null は一覧か雛形。保存済みの中身は lists。
  const [openId, setOpenId] = useState<string | null>(null);
  // 未保存の項目。チェック・追加・削除はここだけ。保存ボタンで DB に書く。
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLines, setTemplateLines] = useState("");
  // 修正中の雛形 id。null は新規登録。入力欄は templateName と templateLines。
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

  /**
   * サーバーが返した雛形とリストを画面に載せる。
   * 各保存 API は全部入りで返すので、一覧の更新はここだけ。
   */
  function apply(next: { templates: CheckTemplate[]; lists: CheckList[] }) {
    setTemplates(next.templates);
    setLists(next.lists);
    return next;
  }

  /**
   * 保存系をまとめて走らせる。失敗したら error だけで、一覧は変えない。
   * 成功した戻りを apply する。busy のあいだはボタンを止める。
   * 「保存できませんでした」を変えるときはここの fallback。
   */
  async function run(action: () => Promise<{ templates: CheckTemplate[]; lists: CheckList[] }>) {
    setBusy(true);
    setError(null);
    try {
      return apply(await action());
    } catch (err) {
      setError(messageOf(err, "保存できませんでした"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  // 初回だけ雛形とリストを読む。アンマウント後の setState は cancelled で捨てる。
  useEffect(() => {
    let cancelled = false;
    getCheckState()
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, "読み込みに失敗しました"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // open は保存済み。dirty は draft との差。allDone は項目が1件以上ですべてチェック。
  const open = lists?.find((list) => list.id === openId) ?? null;
  const dirty = open ? isDirty(open, draft) : false;
  const allDone = draft.length > 0 && doneCount(draft) === draft.length;

  /**
   * 一覧からリストを開く。draft は保存済み項目の写し。
   * 別リストの未保存があっても、ここでは確認しない。戻る確認は closeList。
   */
  function openList(list: CheckList) {
    setOpenId(list.id);
    setDraft(draftFrom(list));
    setItemLabel("");
    setError(null);
  }

  /**
   * 詳細を閉じて一覧へ戻る。
   * 未保存（dirty）なら捨てるか確認する。いいえなら画面のまま。
   * 確認文を変えるときはこの confirm。
   */
  function closeList() {
    // いいえなら閉じない。draft も DB もそのまま。
    if (open && dirty && !window.confirm("保存していない変更を捨てますか？")) return;
    setOpenId(null);
    setDraft([]);
    setItemLabel("");
  }

  /**
   * 新しいリストを作る。名前は必須。雛形は空なら無し。
   * 項目のコピーとチェックオフは API の createCheckList。
   * 成功したら戻り lists の先頭（新しい順）を開く。
   */
  async function onCreateList(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = await run(() => createCheckList({ data: { name: trimmed, templateId: templateId || null } }));
    if (!next) return;
    setName("");
    setTemplateId("");
    const created = next.lists[0];
    if (created) openList(created);
  }

  /**
   * 開いているリストに項目を足す。画面の draft だけ。保存まで DB は変わらない。
   * 追加した行のチェックはオフ。文字数の上限は入力の maxLength（80）。
   */
  function onAddItem(event: FormEvent) {
    event.preventDefault();
    const label = itemLabel.trim();
    if (!label) return;
    setDraft((current) => [...current, { key: `new-${crypto.randomUUID()}`, label, checked: false }]);
    setItemLabel("");
  }

  /**
   * 開いているリストを保存する。
   * 全部チェック済みなら削除の確認だけする。はいなら削除し、項目は保存しない。
   * いいえなら画面のまま（未保存のチェックも残る）。空リストは削除確認にしない。
   * 確認文はここの confirm。全部済みでないときだけ saveCheckList。
   */
  async function onSaveList() {
    if (!open) return;
    // 全部チェック済みは保存しない。はいのときだけリストを消す。いいえは return。
    if (allDone) {
      if (!window.confirm(`${open.name} は全部チェック済みです。このリストを削除しますか？`)) return;
      const next = await run(() => deleteCheckList({ data: { id: open.id } }));
      if (!next) return;
      setOpenId(null);
      setDraft([]);
      return;
    }
    const next = await run(() =>
      saveCheckList({
        data: { id: open.id, items: draft.map((item) => ({ label: item.label, checked: item.checked })) },
      }),
    );
    const saved = next?.lists.find((list) => list.id === open.id);
    if (saved) setDraft(draftFrom(saved));
  }

  /**
   * 雛形を登録するか、項目ごと上書きする。項目は改行で区切り、空行は捨てる。
   * editingTemplate があればその id で更新。件数の上限は API（40件、各80文字）。
   * 成功したら入力を空にして新規に戻す。
   */
  async function onSaveTemplate(event: FormEvent) {
    event.preventDefault();
    const items = templateLines
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const next = await run(() =>
      saveCheckTemplate({
        data: {
          ...(editingTemplate ? { id: editingTemplate } : {}),
          name: templateName.trim(),
          items,
        },
      }),
    );
    if (!next) return;
    setTemplateName("");
    setTemplateLines("");
    setEditingTemplate(null);
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <BusyOverlay show={busy || lists === null} label={lists === null ? "読み込み中…" : "保存中…"} />
      <PageHeading title="チェックリスト">
        {open ? (
          <button type="button" className="text-sm font-medium text-primary" onClick={closeList}>
            一覧
          </button>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-primary"
            // 一覧と雛形を切り替える。詳細を開いているときはこのボタンは出ない。
            onClick={() => setView((current) => (current === "lists" ? "templates" : "lists"))}
          >
            {view === "lists" ? "雛形" : "リスト"}
          </button>
        )}
      </PageHeading>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <section className="rounded-lg border border-border bg-surface p-3 shadow-card">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-base font-semibold text-fg">{open.name}</p>
            <p className="text-xs text-muted">
              {doneCount(draft)}/{draft.length}
            </p>
          </div>
          {allDone ? <p className="mt-1 text-xs text-muted">全部済みです。保存すると削除の確認が出ます。</p> : null}
          {draft.length === 0 ? (
            <p className="mt-2 text-xs text-muted">項目を足してください。</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {draft.map((item) => (
                <li key={item.key} className="flex items-center gap-2 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={item.checked}
                      disabled={busy}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraft((current) =>
                          current.map((row) => (row.key === item.key ? { ...row, checked } : row)),
                        );
                      }}
                    />
                    <span className={`truncate text-sm ${item.checked ? "text-muted line-through" : "text-fg"}`}>
                      {item.label}
                    </span>
                  </label>
                  {/* この項目を draft から外すだけ。保存するまで DB の項目は残る。 */}
                  <button
                    type="button"
                    className="shrink-0 text-xs text-muted"
                    disabled={busy}
                    onClick={() => setDraft((current) => current.filter((row) => row.key !== item.key))}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="mt-3 flex gap-2" onSubmit={onAddItem}>
            <Input
              value={itemLabel}
              maxLength={80}
              placeholder="項目を追加"
              aria-label="項目"
              onChange={(event) => setItemLabel(event.target.value)}
            />
            <Button type="submit" variant="outline" className="shrink-0" disabled={!itemLabel.trim()}>
              追加
            </Button>
          </form>
          <Button type="button" className="mt-3 w-full" disabled={busy || !dirty} onClick={() => void onSaveList()}>
            保存
          </Button>
          <button
            type="button"
            className="mt-3 text-xs text-muted"
            disabled={busy}
            onClick={() => {
              // いいえなら削除しない。開いたまま。はいなら詳細を閉じてから消す。
              if (!window.confirm(`${open.name} を削除しますか？`)) return;
              setOpenId(null);
              setDraft([]);
              void run(() => deleteCheckList({ data: { id: open.id } }));
            }}
          >
            このリストを削除
          </button>
        </section>
      ) : view === "templates" ? (
        <section className="flex flex-col gap-3">
          <form className="rounded-lg border border-border bg-surface p-3 shadow-card" onSubmit={(event) => void onSaveTemplate(event)}>
            <p className="text-sm font-medium text-fg">{editingTemplate ? "雛形を修正" : "雛形を追加"}</p>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="template-name">名前</Label>
              <Input
                id="template-name"
                value={templateName}
                maxLength={40}
                placeholder="例: 出張"
                onChange={(event) => setTemplateName(event.target.value)}
              />
            </div>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="template-items">項目（1行に1つ）</Label>
              <Textarea
                id="template-items"
                value={templateLines}
                rows={6}
                placeholder={"充電器\n着替え"}
                onChange={(event) => setTemplateLines(event.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="submit" className="flex-1" disabled={busy || !templateName.trim()}>
                {editingTemplate ? "更新" : "登録"}
              </Button>
              {editingTemplate ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  // 編集をやめて新規登録に戻す。DB は変えない。
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateName("");
                    setTemplateLines("");
                  }}
                >
                  取消
                </Button>
              ) : null}
            </div>
          </form>
          <ul className="flex flex-col gap-2">
            {(templates ?? []).map((template) => (
              <li key={template.id} className="rounded-lg border border-border bg-surface px-3 py-2 shadow-card">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{template.name}</p>
                  {/* この雛形を上のフォームへ出す。項目は改行区切り。保存は onSaveTemplate。 */}
                  <button
                    type="button"
                    className="text-xs font-medium text-primary"
                    onClick={() => {
                      setEditingTemplate(template.id);
                      setTemplateName(template.name);
                      setTemplateLines(template.items.join("\n"));
                    }}
                  >
                    編集
                  </button>
                  {/* 確認ではいなら雛形だけ消す。作済みのリストは残る。いいえは何もしない。 */}
                  <button
                    type="button"
                    className="text-xs text-muted"
                    disabled={busy}
                    onClick={() => {
                      // いいえなら消さない。
                      if (!window.confirm(`${template.name} の雛形を削除しますか？`)) return;
                      // いま編集中の雛形なら、入力を空にして新規に戻す。
                      if (editingTemplate === template.id) {
                        setEditingTemplate(null);
                        setTemplateName("");
                        setTemplateLines("");
                      }
                      void run(() => deleteCheckTemplate({ data: { id: template.id } }));
                    }}
                  >
                    削除
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {template.items.length > 0 ? template.items.join("、") : "項目なし"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <form className="rounded-lg border border-border bg-surface p-3 shadow-card" onSubmit={(event) => void onCreateList(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="list-name">リスト名</Label>
              <Input
                id="list-name"
                value={name}
                maxLength={40}
                placeholder="例: 来週の旅行"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="list-template">雛形</Label>
              <Select id="list-template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">なし</option>
                {(templates ?? []).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="mt-3 w-full" disabled={busy || !name.trim()}>
              作る
            </Button>
          </form>
          {lists && lists.length === 0 ? (
            <p className="text-sm text-muted">リストはまだありません。雛形がなくても作れます。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(lists ?? []).map((list) => {
                const done = doneCount(list.items);
                // 項目が1件以上かつ全部チェックだけ「全部済み」。空は 0/0 のまま。
                const finished = list.items.length > 0 && done === list.items.length;
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-left shadow-card"
                      onClick={() => openList(list)}
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-fg">{list.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {finished ? "全部済み" : `${done}/${list.items.length}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
