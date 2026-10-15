/**
 * 多頭の体重と定番ごはん（/calorie-batch）。
 * 日付は暮らし帳で見ている日。未指定なら今日。
 */
import { createFileRoute } from "@tanstack/react-router";
import { HouseholdDay } from "@/components/calorie/household-day";
import { Protected } from "@/components/protected";
import { peekCalorieState } from "@/lib/calorie/held";
import { todayJst } from "@/lib/calorie/formula";

export const Route = createFileRoute("/calorie-batch")({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: BatchPage,
});

function BatchPage() {
  const { date } = Route.useSearch();
  const shown = date ?? peekCalorieState()?.date ?? todayJst();
  return (
    <Protected>
      <HouseholdDay date={shown} />
    </Protected>
  );
}
