import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { rebuildAllCalorieStats } from "@/lib/calorie/summary";
import { appendCronLog, finishCronRun, startCronRun } from "@/lib/cron-log";
import { resetSmokingIfDue } from "@/lib/smoking/api";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret) return auth === `Bearer ${secret}`;
  return request.headers.get("x-vercel-cron") === "1";
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

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
        try {
          const result = await rebuildAllCalorieStats(sql);
          await write(`[cron] calorie ${JSON.stringify(result)}`);
          await finishCronRun(sql, runId, true);
          return Response.json({ ok: true, ...result, smoking });
        } catch (err) {
          const message = errorText(err, "集計に失敗しました");
          await write(`[cron] calorie error ${message}`);
          await finishCronRun(sql, runId, false);
          return Response.json({ error: message, smoking }, { status: 500 });
        }
      },
    },
  },
});
