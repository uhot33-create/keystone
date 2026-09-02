import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DailyFortune, DailyQuote, FortuneKind, FortuneLine, OnThisDay } from "./types";
import { BLOOD_OPTIONS, ETO_OPTIONS, FORTUNE_KINDS, ZODIAC_OPTIONS } from "./types";

const UA = "KurashiCho/1.0 (https://github.com/uhot33-create/keystone)";
const memory = new Map<string, { exp: number; value: unknown }>();

function jstNow(ms = Date.now()) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  const dateLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(ms));
  const [year, month, day] = dateKey.split("-").map(Number);
  return { dateKey, dateLabel, year: year!, month: month!, day: day! };
}

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.value as T);
  return load().then((value) => {
    memory.set(key, { exp: Date.now() + ttlMs, value });
    return value;
  });
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "user-agent": UA, accept: "application/json, text/html, */*", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`取得に失敗しました（${res.status}）`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}

function cleanWiki(text: string): string {
  return text
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .replace(/\[\[ファイル:[^\]]*\]\]/gi, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wikiBullets(section: string): string[] {
  const out: string[] = [];
  for (const raw of section.split("\n")) {
    if (!raw.startsWith("*") || raw.startsWith("*:") || raw.startsWith("**")) continue;
    const line = cleanWiki(raw.replace(/^\*\s*/, ""));
    if (line.length >= 2) out.push(line);
    if (out.length >= 5) break;
  }
  return out;
}

function wikiSection(wikitext: string, heading: string): string {
  const match = wikitext.match(new RegExp(`==+\\s*${heading}\\s*==+\\s*([\\s\\S]*?)(?=\\n==+|$)`));
  return match?.[1] ?? "";
}

async function loadOnThisDay(): Promise<OnThisDay> {
  const { dateKey, dateLabel, year, month, day } = jstNow();
  return cached(`day:${dateKey}`, 6 * 60 * 60 * 1000, async () => {
    const items: string[] = [];
    try {
      const holidays = await fetchJson<Record<string, string>>(
        `https://holidays-jp.github.io/api/v1/${year}/date.json`,
      );
      const holiday = holidays[dateKey];
      if (holiday) items.push(`祝日：${holiday}`);
    } catch {
      /* optional */
    }
    const page = `${month}月${day}日`;
    const encoded = encodeURIComponent(page);
    const payload = await fetchJson<{ parse?: { wikitext?: string } }>(
      `https://ja.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&formatversion=2&redirects=1`,
    );
    const wikitext = payload.parse?.wikitext ?? "";
    const days = wikiBullets(wikiSection(wikitext, "記念日・年中行事"));
    const events = wikiBullets(wikiSection(wikitext, "できごと")).slice(0, 2);
    for (const item of [...days, ...events]) {
      if (!items.includes(item)) items.push(item);
    }
    if (items.length === 0) throw new Error("今日は何の日を取得できませんでした");
    return {
      dateLabel,
      items: items.slice(0, 6),
      source: "Wikipedia / 内閣府祝日",
    };
  });
}

async function loadQuote(): Promise<DailyQuote> {
  const { dateKey } = jstNow();
  return cached(`quote:${dateKey}`, 6 * 60 * 60 * 1000, async () => {
    try {
      const rows = await fetchJson<{ meigen?: string; auther?: string; author?: string }[]>(
        "https://meigen.doodlenote.net/api/json.php?c=1",
      );
      const row = rows[0];
      const text = row?.meigen?.trim();
      if (text) {
        return {
          text,
          author: (row.auther || row.author || "").trim(),
          source: "名言教えるよ",
        };
      }
    } catch {
      /* fallback */
    }
    const proverb = await fetchJson<{ text?: string; meaning?: string; kana?: string }>(
      "https://apis-cloud.net/kotowaza/random",
    );
    const text = proverb.text?.trim();
    if (!text) throw new Error("格言を取得できませんでした");
    return {
      text: proverb.meaning ? `${text}（${proverb.meaning}）` : text,
      author: proverb.kana ?? "",
      source: "ことわざ・故事成語API",
    };
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function loadZodiac(key: string): Promise<DailyFortune> {
  const sign = ZODIAC_OPTIONS.find((item) => item.id === key) ?? ZODIAC_OPTIONS[0]!;
  const { dateKey } = jstNow();
  return cached(`zodiac:${dateKey}:${sign.id}`, 3 * 60 * 60 * 1000, async () => {
    const html = await fetchText(`https://www.asahi.com/uranai/12seiza/${sign.id}.html`);
    const lines: FortuneLine[] = [];
    const blockRe =
      /<dt><span>([^<]+)<\/span>[\s\S]*?alt="[^"]*?(\d+)ポイント[\s\S]*?<dd><p>([\s\S]*?)<\/p>/g;
    for (const match of html.matchAll(blockRe)) {
      lines.push({
        label: match[1] ?? "",
        score: Number(match[2]) || null,
        text: stripHtml(match[3] ?? ""),
      });
    }
    if (lines.length === 0) throw new Error("星座占いを取得できませんでした");
    return {
      kind: "zodiac",
      key: sign.id,
      title: sign.label,
      lines,
      source: "朝日新聞デジタル",
    };
  });
}

function dailyScore(seed: string): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return 1 + (hash % 5);
}

async function loadAdviceFortune(kind: FortuneKind, key: string, title: string): Promise<DailyFortune> {
  const { dateKey } = jstNow();
  return cached(`${kind}:${dateKey}:${key}`, 6 * 60 * 60 * 1000, async () => {
    const proverb = await fetchJson<{ text?: string; meaning?: string }>(
      "https://apis-cloud.net/kotowaza/random",
    );
    const advice = proverb.meaning
      ? `${proverb.text}。${proverb.meaning}`
      : proverb.text || "静かに整える一日です。";
    const score = dailyScore(`${dateKey}:${kind}:${key}`);
    const labels = kind === "blood" ? ["総合運", "対人運", "健康運"] : ["総合運", "仕事運", "対人運"];
    const lines: FortuneLine[] = labels.map((label, index) => ({
      label,
      score: 1 + ((score + index * 2 - 1) % 5),
      text: index === 0 ? advice : "焦らず、今日できることを一つだけ。",
    }));
    return {
      kind,
      key,
      title,
      lines,
      source: "ことわざ・故事成語API",
    };
  });
}

function optionsFor(kind: FortuneKind) {
  if (kind === "blood") return BLOOD_OPTIONS;
  if (kind === "eto") return ETO_OPTIONS;
  return ZODIAC_OPTIONS;
}

function isKind(value: string): value is FortuneKind {
  return FORTUNE_KINDS.some((item) => item.id === value);
}

const fortuneInput = z.object({
  kind: z.string(),
  key: z.string(),
});

export const getDesk = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const parsed = fortuneInput.safeParse(input ?? {});
    if (!parsed.success) return { kind: "zodiac", key: "aries" };
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const kind: FortuneKind = isKind(data.kind) ? data.kind : "zodiac";
    const options = optionsFor(kind);
    const key = options.some((item) => item.id === data.key) ? data.key : options[0]!.id;
    const title = options.find((item) => item.id === key)?.label ?? key;
    const errors: string[] = [];
    const [dayRes, quoteRes, fortuneRes] = await Promise.allSettled([
      loadOnThisDay(),
      loadQuote(),
      kind === "zodiac" ? loadZodiac(key) : loadAdviceFortune(kind, key, title),
    ]);
    const onThisDay = dayRes.status === "fulfilled" ? dayRes.value : null;
    const quote = quoteRes.status === "fulfilled" ? quoteRes.value : null;
    const fortune = fortuneRes.status === "fulfilled" ? fortuneRes.value : null;
    if (dayRes.status === "rejected") errors.push("今日は何の日を取得できませんでした");
    if (quoteRes.status === "rejected") errors.push("格言を取得できませんでした");
    if (fortuneRes.status === "rejected") errors.push("占いを取得できませんでした");
    return { onThisDay, quote, fortune, errors };
  });
