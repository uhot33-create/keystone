import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getDesk } from "@/lib/desk/api";
import {
  BLOOD_OPTIONS,
  ETO_OPTIONS,
  FORTUNE_KINDS,
  ZODIAC_OPTIONS,
  type DeskState,
  type FortuneKind,
} from "@/lib/desk/types";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const KIND_KEY = "kurashi-fortune-kind";
const VALUE_KEY = "kurashi-fortune-key";

function readStored(): { kind: FortuneKind; key: string } {
  if (typeof localStorage === "undefined") return { kind: "zodiac", key: "aries" };
  try {
    const kindRaw = localStorage.getItem(KIND_KEY);
    const kind = FORTUNE_KINDS.some((item) => item.id === kindRaw) ? (kindRaw as FortuneKind) : "zodiac";
    const options = optionsFor(kind);
    const keyRaw = localStorage.getItem(VALUE_KEY);
    const key = options.some((item) => item.id === keyRaw) ? keyRaw! : options[0]!.id;
    return { kind, key };
  } catch {
    return { kind: "zodiac", key: "aries" };
  }
}

function optionsFor(kind: FortuneKind) {
  if (kind === "blood") return BLOOD_OPTIONS;
  if (kind === "eto") return ETO_OPTIONS;
  return ZODIAC_OPTIONS;
}

function Score({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <span className="ml-2 inline-flex gap-0.5" aria-label={`${value} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`size-1.5 rounded-full ${i < value ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </span>
  );
}

export function DeskPanel() {
  const initial = useMemo(readStored, []);
  const [kind, setKind] = useState<FortuneKind>(initial.kind);
  const [key, setKey] = useState(initial.key);
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDesk(null);
    getDesk({ data: { kind, key } })
      .then((next) => {
        if (!cancelled) setDesk(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "取得できませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, key]);

  function persist(nextKind: FortuneKind, nextKey: string) {
    setKind(nextKind);
    setKey(nextKey);
    try {
      localStorage.setItem(KIND_KEY, nextKind);
      localStorage.setItem(VALUE_KEY, nextKey);
    } catch {
      /* ignore */
    }
  }

  const options = optionsFor(kind);

  return (
    <div className="flex flex-col gap-4">
      <DeskCard title="今日は何の日">
        {!desk ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : desk.onThisDay ? (
          <>
            <p className="font-display text-base font-semibold text-fg">{desk.onThisDay.dateLabel}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {desk.onThisDay.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-subtle">出典 {desk.onThisDay.source}</p>
          </>
        ) : (
          <p className="text-sm text-muted">今日は何の日を表示できませんでした。</p>
        )}
      </DeskCard>

      <DeskCard title="今日の格言">
        {!desk ? (
          <Skeleton className="h-16 w-full rounded-md" />
        ) : desk.quote ? (
          <>
            <p className="font-display text-base leading-relaxed text-fg">「{desk.quote.text}」</p>
            {desk.quote.author ? <p className="mt-2 text-sm text-muted">— {desk.quote.author}</p> : null}
            <p className="mt-3 text-[11px] text-subtle">出典 {desk.quote.source}</p>
          </>
        ) : (
          <p className="text-sm text-muted">格言を表示できませんでした。</p>
        )}
      </DeskCard>

      <DeskCard title="今日の占い">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="fortune-kind">種類</Label>
            <Select
              id="fortune-kind"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as FortuneKind;
                persist(next, optionsFor(next)[0]!.id);
              }}
            >
              {FORTUNE_KINDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fortune-key">{kind === "zodiac" ? "星座" : kind === "blood" ? "血液型" : "干支"}</Label>
            <Select
              id="fortune-key"
              value={key}
              onChange={(event) => persist(kind, event.target.value)}
            >
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {!desk ? (
          <Skeleton className="mt-4 h-28 w-full rounded-md" />
        ) : desk.fortune ? (
          <div className="mt-4 space-y-3">
            <p className="font-display text-base font-semibold text-fg">{desk.fortune.title}</p>
            {desk.fortune.lines.map((line) => (
              <div key={line.label}>
                <p className="flex items-center text-xs font-medium tracking-widest text-subtle">
                  {line.label}
                  <Score value={line.score} />
                </p>
                <p className="mt-1 text-sm text-fg">{line.text}</p>
              </div>
            ))}
            <p className="text-[11px] text-subtle">出典 {desk.fortune.source}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">占いを表示できませんでした。</p>
        )}
      </DeskCard>

      {error || desk?.errors.length ? (
        <p className="text-xs text-muted">{error || desk?.errors.join(" / ")}</p>
      ) : null}
    </div>
  );
}

function DeskCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-xs font-medium tracking-widest text-subtle">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
