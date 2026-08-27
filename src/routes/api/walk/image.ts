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
        const id = new URL(request.url).searchParams.get("id")?.trim();
        if (!id) {
          return new Response("id がありません", { status: 400 });
        }
        const sql = await getSql();
        const rows = await sql<{ image_url: string | null; image_pathname: string | null }>`
          select image_url, image_pathname
          from memos
          where id = ${id} and user_id = ${user.id}
          limit 1
        `;
        const row = rows[0];
        const target = row?.image_url || row?.image_pathname;
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
