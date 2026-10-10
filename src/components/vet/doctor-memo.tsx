/**
 * 「次回、先生に伝えること」のメモ。
 * DoctorMemoCard は /vet の一覧に出る編集欄。DoctorMemoCopy は入力フォームのコピー欄。
 * 本文は最大1000文字。保存先はユーザーごとに1件（saveDoctorMemo）。
 * コピーはクリップボード。使えないときは古い方法（execCommand）に切り替える。
 */
import { useEffect, useState } from "react";
import { getDoctorMemo, saveDoctorMemo } from "@/lib/vet/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** 一覧用。開いたときに読み、保存ボタンで上書きする。 */
export function DoctorMemoCard() {
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoctorMemo()
      .then((memo) => {
        if (!cancelled) setBody(memo.body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "メモを読み込めませんでした");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveDoctorMemo({ data: { body } });
      setBody(next.body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "メモを保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
      <p className="text-xs font-medium tracking-widest text-subtle">次回、先生に伝えること</p>
      <Textarea
        className="mt-2"
        value={body}
        maxLength={1000}
        rows={3}
        disabled={!ready || pending}
        placeholder="食欲が落ちている、足をひきずる など"
        onChange={(event) => {
          setBody(event.target.value);
          setSaved(false);
        }}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={!ready || pending} onClick={() => void save()}>
          保存
        </Button>
        {saved ? <p className="text-xs text-muted">保存しました</p> : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** フォーム用。本文が空なら何も出さない。ボタンで全文をコピーする。 */
export function DoctorMemoCopy() {
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoctorMemo()
      .then((memo) => {
        if (!cancelled) setBody(memo.body);
      })
      .catch(() => {
        if (!cancelled) setBody("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!body) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      const area = document.createElement("textarea");
      area.value = body;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-widest text-subtle">次回、先生に伝えること</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? "コピーしました" : "コピー"}
        </Button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{body}</p>
    </div>
  );
}
