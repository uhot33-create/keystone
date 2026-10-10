/**
 * コネクタがログインを要求したときの判定と、ログイン画面への移動。
 * iframe の中なら新しいタブ、そうでなければ同じ画面で開く。
 * ログイン URL はサーバーが CallToolResult.loginUrl に載せる。
 */
import type { CallToolResult } from "./types.ts";

/** ok が false かつ loginRequired のときだけ true。 */
export function isLoginRequired(result: CallToolResult): boolean {
  return result.ok === false && result.loginRequired === true;
}

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** ログインが必要なら移動して true。URL が無い・サーバー上なら false。 */
export function redirectToLoginIfRequired(result: CallToolResult): boolean {
  if (!isLoginRequired(result)) return false;
  const url = result.loginUrl;
  if (!url) return false;
  if (typeof window === "undefined") return false;
  if (isFramed()) {
    const opened = window.open(url, "_blank");
    if (opened) {
      opened.opener = null;
      return true;
    }
  }
  window.location.assign(url);
  return true;
}
