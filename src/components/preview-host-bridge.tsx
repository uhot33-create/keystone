/**
 * プレビュー埋め込み用の橋。ルートで一度だけ置く。
 * Grok のプレビューからページ移動を受け取る。普通に開いているときは何もしない。
 * メッセージの中身は lib/preview-host-bridge.ts。
 */
/**
 * Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
 * (and later receive registered routes). Noops when the app is not embedded.
 */

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  collectRoutePathsFromTree,
  installPreviewHostBridge,
} from "@/lib/preview-host-bridge";

/** ルーターを橋に渡し、外からの移動を history に流す。画面は描かない。 */
export function PreviewHostBridge() {
  const router = useRouter();

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        router.history.push(path);
      },
      getRoutePaths: () => collectRoutePathsFromTree(router.routeTree),
    });
  }, [router]);

  return null;
}
