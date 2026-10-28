/**
 * カップ麺ページの入口。
 * 画面は /cup。表示は CupApp。ログインしていない人は Protected で止める。
 * 30日強調や並び順はこのファイルにはない。
 * 画像のURLは /api/cup/image。
 */
import { createFileRoute } from "@tanstack/react-router";
import { CupApp } from "@/components/cup/cup-app";
import { Protected } from "@/components/protected";

/** カップ麺ルート。 */
export const Route = createFileRoute("/cup")({ component: CupPage });

/** ログイン後だけ CupApp を出す。品目の読み書きは components/cup/cup-app.tsx。 */
function CupPage() {
  return (
    <Protected>
      <CupApp />
    </Protected>
  );
}
