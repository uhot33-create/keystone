/**
 * 最近の犬ネタを最大4件取る。
 * 画面はホームの机パネル（項目 id は dogNews）。
 * 検索語は QUERIES。上から順に Google ニュース RSS を試し、同じ見出しは捨てる。
 * 日本時間の日付ごとに desk_dog_news へ1行キャッシュする。
 * force が true のときだけ取り直して上書きする。
 */
import { getSql } from "@/lib/db";
import type { DogNews, DogNewsItem } from "./types";

const UA = "KurashiCho/1.0 (https://github.com/uhot33-create/keystone)";

/** 検索の順番。when:14d は新しい記事を優先するクエリ。最大4件で打ち切る。 */
const QUERIES = [
  "チワワ (グッズ OR ごはん OR おやつ OR フード OR イベント) when:14d",
  "犬 (グッズ OR ごはん OR おやつ OR イベント) when:14d",
  "チワワ (グッズ OR ごはん OR おやつ OR フード OR イベント)",
];

function jstDateKey(ms = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/"/g, '"')
    .replace(/'|&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(xml: string): DogNewsItem[] {
  const items: DogNewsItem[] = [];
  for (const block of xml.split(/<item\b/i).slice(1)) {
    const chunk = block.split(/<\/item>/i)[0] ?? "";
    const titleRaw = decodeXml(chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = decodeXml(chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const source = decodeXml(chunk.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "");
    const publishedAt = decodeXml(chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "") || null;
    const title = source && titleRaw.endsWith(` - ${source}`) ? titleRaw.slice(0, -(source.length + 3)).trim() : titleRaw;
    if (!title || !link.startsWith("http")) continue;
    items.push({ title, source: source || "Googleニュース", url: link, publishedAt });
  }
  return items;
}

async function searchNews(query: string): Promise<DogNewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`ニュースを取得できませんでした（${res.status}）`);
  return parseRss(await res.text());
}

async function collectNews(): Promise<DogNewsItem[]> {
  const picked: DogNewsItem[] = [];
  const seen = new Set<string>();
  for (const query of QUERIES) {
    let batch: DogNewsItem[] = [];
    try {
      batch = await searchNews(query);
    } catch {
      continue;
    }
    for (const item of batch) {
      const key = item.title.replace(/\s/g, "");
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
      if (picked.length >= 4) return picked;
    }
  }
  if (picked.length === 0) throw new Error("犬ネタが見つかりませんでした");
  return picked;
}

function asItems(value: unknown): DogNewsItem[] {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title : "";
    const url = typeof row.url === "string" ? row.url : "";
    const source = typeof row.source === "string" ? row.source : "Googleニュース";
    const publishedAt = typeof row.publishedAt === "string" ? row.publishedAt : null;
    if (!title || !url.startsWith("http")) return [];
    return [{ title, url, source, publishedAt }];
  });
}

/** 今日のキャッシュがあればそれを返す。無ければ取得して保存。 */
export async function loadDogNews(force = false): Promise<DogNews> {
  const sql = await getSql();
  const shownOn = jstDateKey();
  if (!force) {
    const cached = await sql<{ items: unknown }>`
      select items from desk_dog_news where shown_on = ${shownOn} limit 1
    `;
    const items = asItems(cached[0]?.items);
    if (items.length > 0) return { items, source: "Googleニュース" };
  }
  const items = await collectNews();
  await sql`
    insert into desk_dog_news (shown_on, items, fetched_at)
    values (${shownOn}, ${JSON.stringify(items)}::jsonb, now())
    on conflict (shown_on) do update set
      items = excluded.items,
      fetched_at = now()
  `;
  return { items, source: "Googleニュース" };
}
