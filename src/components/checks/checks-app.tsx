/**
 * 人のチェックリスト画面。
 * リストの作成、雛形からのコピー、項目のチェック。履歴は出さない。
 * 全部チェックしたリストは、日次処理で消える。
 */
import { useEffect, useState, type FormEvent } from "react";
import {
  addCheckItem,
  createCheckList,
  deleteCheckItem,
  deleteCheckList,
  deleteCheckTemplate,
  getCheckState,
  saveCheckTemplate,
  toggleCheckItem,
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

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function doneCount(list: CheckList) {
  return list.items.filter((item) => item.checked).length;
}

/** リストと雛形。開いているリストは openId。 */
export function ChecksApp() {
  const [view, setView] = useState<View>("lists");
  const [templates, setTemplates] = useState<CheckTemplate[] | null>(null);
  const [lists, setLists] = useState<CheckList[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLines, setTemplateLines] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

  function apply(next: { templates: CheckTemplate[]; lists: CheckList[] }) {
    setTemplates(next.templates);
    setLists(next.lists);
  }

  async function run(action: () => Promise<{ templates: CheckTemplate[]; lists: CheckList[] }>) {
    setBusy(true);
    setError(null);
    try {
      apply(await action());
    } catch (err) {
      setError(messageOf(err, "保存できませんでした"));
    } finally {
      setBusy(false);
    }
  }

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

  const open = lists?.find((list) => list.id === openId) ?? null;
  const allDone = Boolean(open && open.items.length > 0 && doneCount(open) === open.items.length);

  async function onCreateList(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await run(async () => {
      const next = await createCheckList({
        data: { name: trimmed, templateId: templateId || null },
      });
      setName("");
      setTemplateId("");
      if (next.lists[0]) setOpenId(next.lists[0].id);
      return next;
    });
  }

  async function onAddItem(event: FormEvent) {
    event.preventDefault();
    if (!open) return;
    const label = itemLabel.trim();
    if (!label) return;
    await run(async () => {
      const next = await addCheckItem({ data: { listId: open.id, label } });
      setItemLabel("");
      return next;
    });
  }

  async function onSaveTemplate(event: FormEvent) {
    event.preventDefault();
    const items = templateLines
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    await run(async () => {
      const next = await saveCheckTemplate({
        data: {
          ...(editingTemplate ? { id: editingTemplate } : {}),
          name: templateName.trim(),
          items,
        },
      });
      setTemplateName("");
      setTemplateLines("");
      setEditingTemplate(null);
      return next;
    });
  }

  return (
    <div className="stagger-in flex flex-1 flex-col gap-4">
      <BusyOverlay show={busy || lists === null} label={lists === null ? "読み込み中…" : "保存中…"} />
      <PageHeading title="チェックリスト">
        {open ? (
          <button type="button" className="text-sm font-medium text-primary" onClick={() => setOpenId(null)}>
            一覧
          </button>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-primary"
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
              {doneCount(open)}/{open.items.length}
            </p>
          </div>
          {allDone ? <p className="mt-1 text-xs text-muted">全部済みです。次の0時に消えます。</p> : null}
          {open.items.length === 0 ? (
            <p className="mt-2 text-xs text-muted">項目を足してください。</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {open.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={item.checked}
                      disabled={busy}
                      onChange={(event) =>
                        void run(() => toggleCheckItem({ data: { id: item.id, checked: event.target.checked } }))
                      }
                    />
                    <span className={`truncate text-sm ${item.checked ? "text-muted line-through" : "text-fg"}`}>
                      {item.label}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-muted"
                    disabled={busy}
                    onClick={() => void run(() => deleteCheckItem({ data: { id: item.id } }))}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="mt-3 flex gap-2" onSubmit={(event) => void onAddItem(event)}>
            <Input
              value={itemLabel}
              maxLength={80}
              placeholder="項目を追加"
              aria-label="項目"
              onChange={(event) => setItemLabel(event.target.value)}
            />
            <Button type="submit" className="shrink-0" disabled={busy || !itemLabel.trim()}>
              追加
            </Button>
          </form>
          <button
            type="button"
            className="mt-3 text-xs text-muted"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`${open.name} を削除しますか？`)) return;
              setOpenId(null);
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
                  <button
                    type="button"
                    className="text-xs text-muted"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`${template.name} の雛形を削除しますか？`)) return;
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
                const done = doneCount(list);
                const finished = list.items.length > 0 && done === list.items.length;
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-left shadow-card"
                      onClick={() => setOpenId(list.id)}
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
