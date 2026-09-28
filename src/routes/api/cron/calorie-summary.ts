import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { rebuildAllCalorieStats } from "@/lib/calorie/summary";
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
        try {
          const sql = await getSql();
          const result = await rebuildAllCalorieStats(sql);
          const smoking = await resetSmokingIfDue(sql);
          return Response.json({ ok: true, ...result, smoking });
        } catch (err) {
          const message = err instanceof Error ? err.message : "集計に失敗しました";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
