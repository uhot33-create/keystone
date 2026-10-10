/**
 * Better Auth の受け口（/api/auth/*）。GET と POST を auth.handler に渡すだけ。
 * 認証の中身と環境変数は lib/auth/server.ts。この経路のファイル名は変えない。
 */
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/** /api/auth 以下をすべて Better Auth に渡す。 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
