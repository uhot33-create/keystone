import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { MAX_IMAGE_BYTES } from "@/lib/walk/image";

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

        const body = (await request.json()) as HandleUploadBody;
        try {
          const json = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
              allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
              maximumSizeInBytes: MAX_IMAGE_BYTES,
              addRandomSuffix: true,
              tokenPayload: JSON.stringify({ userId: user.id }),
            }),
          });
          return Response.json(json);
        } catch (err) {
          const message = err instanceof Error ? err.message : "アップロードに失敗しました";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
