/**
 * 定期実行（Vercel Cron）の入口です。GET /api/cron/calorie-summary。
 * 認証は CRON_SECRET があるとき Bearer トークン、無いときはヘッダ x-vercel-cron: 1 だけ通します。
 * 処理は3つです。喫煙カウンタのリセット、散歩ログの月次マージ、
 * カロリー集計の全頭再計算（rebuildAllCalorieStats → calorie_period_stats）。
 * 成否は cron ログ（startCronRun / appendCronLog / finishCronRun）に残します。
 * 期間の区切りや WINDOW、目安の計算を変える場合は summary.ts 側です。ここは呼び出すだけです。
 */
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { rebuildAllCalorieStats } from "@/lib/calorie/summary";
import { appendCronLog, finishCronRun, startCronRun } from "@/lib/cron-log";
import { resetSmokingIfDue } from "@/lib/smoking/api";
import { rebuildAllWalkMonths } from "@/lib/walk-log/merge";

/**
 * Cron からのリクエストか判定します。CRON_SECRET を空にすると、x-vercel-cron: 1 だけで通ります。
 * 秘密を変えたあとは、呼び出す側の Authorization も同じ値にしてください。
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret) return auth === `Bearer ${secret}`;
  return request.headers.get("x-vercel-cron") === "1";
}

/** 失敗時のログ用です。Error なら message、それ以外は fallback の日本語を残します。 */
function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * GET で1回分の定期処理を走らせます。未認証は 401。
 * 喫煙リセットと散歩の月次が失敗しても、カロリーの全頭再計算は続けます。
 * カロリーまで成功すれば 200、そこで失敗すれば 500。集計の中身は summary.ts の rebuildAllCalorieStats です。
 */
export const Route = createFileRoute("/api/cron/calorie-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const sql = await getSql();
        const runId = await startCronRun(sql);
        const write = (line: string) => appendCronLog(sql, runId, line);
        await write(`[cron] start ${new Date().toISOString()}`);
        let smoking: { users: number } | { error: string };
        try {
          smoking = await resetSmokingIfDue(sql);
          await write(`[cron] smoking ${JSON.stringify(smoking)}`);
        } catch (err) {
          const message = errorText(err, "喫煙のリセットに失敗しました");
          smoking = { error: message };
          await write(`[cron] smoking error ${message}`);
        }
        let walks: { months: number; users: number } | { error: string };
        try {
          walks = await rebuildAllWalkMonths(sql);
          await write(`[cron] walk ${JSON.stringify(walks)}`);
        } catch (err) {
          const message = errorText(err, "散歩ログの月次マージに失敗しました");
          walks = { error: message };
          await write(`[cron] walk error ${message}`);
        }
        try {
          const result = await rebuildAllCalorieStats(sql);
          await write(`[cron] calorie ${JSON.stringify(result)}`);
          await write("処理を完了しました。");
          await finishCronRun(sql, runId, true);
          return Response.json({ ok: true, ...result, smoking, walks });
        } catch (err) {
          const message = errorText(err, "集計に失敗しました");
          await write(`[cron] calorie error ${message}`);
          await finishCronRun(sql, runId, false);
          return Response.json({ error: message, smoking, walks }, { status: 500 });
        }
      },
    },
  },
});
