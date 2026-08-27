import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { MAX_UPLOAD_BYTES } from "@/lib/walk/image";

export const Route = createFileRoute("/api/blob/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) {
          return Response.json({ error: "ログインが必要です" }, { status: 401 });
        }
        if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
          return Response.json(
            { error: "画像の保存には Vercel Blob の設定が必要です" },
            { status: 501 },
          );
        }

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "画像ファイルを選んでください" }, { status: 400 });
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          return Response.json({ error: "画像が大きすぎます" }, { status: 400 });
        }

        const type = file.type || "image/jpeg";
        if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
          return Response.json({ error: "jpeg / png / webp の画像にしてください" }, { status: 400 });
        }

        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        try {
          const blob = await put(`walk/${user.id}/${crypto.randomUUID()}.${ext}`, file, {
            access: "public",
            addRandomSuffix: false,
            contentType: type,
          });
          return Response.json({ url: blob.url, pathname: blob.pathname });
        } catch (err) {
          const message = err instanceof Error ? err.message : "アップロードに失敗しました";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
