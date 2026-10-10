/**
 * コネクタクライアントをブラウザに載せないためのガード。
 * window がある場所から読まれたらすぐ例外にする。文言は throw の文字列。
 * 種類やログイン補助は index.ts 経由ならクライアントでも安全。
 */
/** サーバー以外で読まれたら例外。context はエラー文に入るファイル名。 */
export function assertAppDataServerOnly(
  context = "app-data/client.server",
): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `@/lib/${context} is server-only. Call connector tools from a createServerFn handler (dynamic import of @/lib/app-data/client.server), never from a React component, useEffect, or browser fetch. Types and login helpers are client-safe via @/lib/app-data.`,
    );
  }
}

assertAppDataServerOnly("app-data/client.server");
