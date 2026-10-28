/**
 * 多頭の体重と定番ごはん（/calorie-batch）。ログイン必須（Protected）。
 * 日付は URL の date、無ければ暮らし帳が持っている日、それも無ければ今日（JST）。
 * 保存の本体は components/calorie/household-day.tsx。集計の更新は api.ts の saveHouseholdWeights。
 */
import { createFileRoute } from "@tanstack/react-router";
import { HouseholdDay } from "@/components/calorie/household-day";
import { Protected } from "@/components/protected";
import { peekCalorieState } from "@/lib/calorie/held";
import { todayJst } from "@/lib/calorie/formula";

/** ログイン後のまとめて入力。日付の決め方は BatchPage。 */
export const Route = createFileRoute("/calorie-batch")({
  /** URL の date は YYYY-MM-DD だけ通す。壊れた値は未指定にし、画面側がキャッシュか今日へ落とす。 */
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: BatchPage,
});

/** 渡す日付を決めて HouseholdDay に渡す。このファイルでは取得しない。 */
function BatchPage() {
  const { date } = Route.useSearch();
  const shown = date ?? peekCalorieState()?.date ?? todayJst();
  return (
    <Protected>
      <HouseholdDay date={shown} />
    </Protected>
  );
}
