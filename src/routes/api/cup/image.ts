import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/walk/image";

function asUploadBlob(value: FormDataEntryValue | null): Blob | null {
  if (!value || typeof value === "string") return null;
  if (typeof (value as Blob).arrayBuffer !== "function") return null;
  if (!(value as Blob).size) return null;
  return value as Blob;
}

export const Route = createFileRoute("/api/cup/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
        const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
        const form = await request.formData().catch(() => null);
        const file = asUploadBlob(form?.get("file") ?? null);
        if (!file) return Response.json({ error: "画像ファイルを選んでください" }, { status: 400 });
        if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "画像が大きすぎます" }, { status: 400 });
        const type =
          file.type === "image/png" || file.type === "image/webp" || file.type === "image/jpeg"
            ? file.type
            : "image/jpeg";
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          const blob = await put(`cup/${user.id}/${crypto.randomUUID()}.${ext}`, buf, {
            access: "private",
            contentType: type,
            ...(token ? { token } : {}),
          });
          return Response.json({ url: blob.url, pathname: blob.pathname });
        } catch (err) {
          const message = err instanceof Error ? err.message : "アップロードに失敗しました";
          return Response.json({ error: message }, { status: 400 });
        }
      },
      GET: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) return new Response("ログインが必要です", { status: 401 });
        const id = new URL(request.url).searchParams.get("id")?.trim();
        if (!id) return new Response("id がありません", { status: 400 });
        const sql = await getSql();
        const rows = await sql<{ image_url: string | null; image_pathname: string | null }>`
          select image_url, image_pathname
          from cup_items
          where id = ${id} and user_id = ${user.id}
          limit 1
        `;
        const target = rows[0]?.image_url || rows[0]?.image_pathname;
        if (!target) return new Response("画像がありません", { status: 404 });
        try {
          const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
          const { get } = await import("@vercel/blob");
          const result = await get(target, { access: "private", ...(token ? { token } : {}) });
          if (!result || result.statusCode !== 200 || !result.stream) {
            return new Response("画像がありません", { status: 404 });
          }
          return new Response(result.stream, {
            headers: {
              "Content-Type": result.blob.contentType || "image/jpeg",
              "Cache-Control": "private, no-cache, must-revalidate",
            },
          });
        } catch {
          return new Response("画像を取得できませんでした", { status: 502 });
        }
      },
    },
  },
});
