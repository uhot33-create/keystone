import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { MAX_UPLOAD_BYTES } from "@/lib/walk/image";

function asUploadBlob(value: FormDataEntryValue | null): Blob | null {
  if (!value || typeof value === "string") return null;
  if (typeof (value as Blob).arrayBuffer !== "function") return null;
  if (!(value as Blob).size) return null;
  return value as Blob;
}

export const Route = createFileRoute("/api/blob/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) {
          return Response.json({ error: "ログインが必要です" }, { status: 401 });
        }
        const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

        const form = await request.formData().catch(() => null);
        const file = asUploadBlob(form?.get("file") ?? null);
        if (!file) {
          return Response.json({ error: "画像ファイルを選んでください" }, { status: 400 });
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          return Response.json({ error: "画像が大きすぎます" }, { status: 400 });
        }

        const type =
          file.type === "image/png" || file.type === "image/webp" || file.type === "image/jpeg"
            ? file.type
            : "image/jpeg";
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          const blob = await put(`walk/${user.id}/${crypto.randomUUID()}.${ext}`, buf, {
            access: "public",
            contentType: type,
            ...(token ? { token } : {}),
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
