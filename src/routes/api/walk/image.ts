import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/walk/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) {
          return new Response("ログインが必要です", { status: 401 });
        }
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        const indexRaw = url.searchParams.get("i");
        if (!id) {
          return new Response("id がありません", { status: 400 });
        }
        const sql = await getSql();
        const rows = await sql<{
          images: unknown;
          cover_index: unknown;
          image_url: string | null;
          image_pathname: string | null;
        }>`
          select images, cover_index, image_url, image_pathname
          from memos
          where id = ${id} and user_id = ${user.id}
          limit 1
        `;
        const row = rows[0];
        if (!row) {
          return new Response("画像がありません", { status: 404 });
        }
        const parsed = typeof row.images === "string"
          ? (() => {
              try {
                return JSON.parse(row.images) as unknown;
              } catch {
                return [];
              }
            })()
          : row.images;
        const list = Array.isArray(parsed)
          ? parsed.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const rec = item as { url?: unknown; pathname?: unknown };
              const href = typeof rec.url === "string" ? rec.url : "";
              if (!href) return [];
              return [{ url: href, pathname: typeof rec.pathname === "string" ? rec.pathname : null }];
            })
          : [];
        const fallback = row.image_url
          ? [{ url: row.image_url, pathname: row.image_pathname }]
          : [];
        const images = list.length > 0 ? list : fallback;
        const parsedIndex = indexRaw == null || indexRaw === "" ? Number(row.cover_index) || 0 : Number(indexRaw);
        const i = Number.isFinite(parsedIndex) ? Math.min(Math.max(0, Math.round(parsedIndex)), Math.max(0, images.length - 1)) : 0;
        const target = images[i]?.url || images[i]?.pathname || row.image_url || row.image_pathname;
        if (!target) {
          return new Response("画像がありません", { status: 404 });
        }
        try {
          const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
          const { get } = await import("@vercel/blob");
          const result = await get(target, {
            access: "private",
            ...(token ? { token } : {}),
          });
          if (!result || result.statusCode !== 200 || !result.stream) {
            return new Response("画像がありません", { status: 404 });
          }
          const type = result.blob.contentType || "image/jpeg";
          return new Response(result.stream, {
            headers: {
              "Content-Type": type,
              "Cache-Control": "private, max-age=3600",
            },
          });
        } catch {
          return new Response("画像を取得できませんでした", { status: 502 });
        }
      },
    },
  },
});
