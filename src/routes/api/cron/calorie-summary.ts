import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { rebuildAllCalorieStats } from "@/lib/calorie/summary";
import { finishCronRun, saveSmokingCron, startCronRun } from "@/lib/cron-log";
import { resetSmokingIfDue } from "@/lib/smoking/api";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret) return auth === `Bearer ${secret}`;
  return request.headers.get("x-vercel-cron") === "1";
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
        let smoking: { users: number } | { error: string };
        try {
          smoking = await resetSmokingIfDue(sql);
          await saveSmokingCron(sql, runId, smoking.users, null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "喫煙のリセットに失敗しました";
          smoking = { error: message };
          await saveSmokingCron(sql, runId, null, message);
        }
        try {
          const result = await rebuildAllCalorieStats(sql);
          await finishCronRun(sql, runId, true, result.dogs, null);
          return Response.json({ ok: true, ...result, smoking });
        } catch (err) {
          const message = err instanceof Error ? err.message : "集計に失敗しました";
          await finishCronRun(sql, runId, false, null, message);
          return Response.json({ error: message, smoking }, { status: 500 });
        }
      },
    },
  },
});