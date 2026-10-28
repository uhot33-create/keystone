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

/**
 * ログイン後のまとめて入力。日付の決め方は BatchPage。
 * URL は /calorie-batch。中身は HouseholdDay。保存は saveHouseholdWeights。
 * 検索の形を変えるなら validateSearch。2週間ロックは画面側。
 */
export const Route = createFileRoute("/calorie-batch")({
  /** URL の date は YYYY-MM-DD だけ通す。壊れた値は未指定にし、画面側がキャッシュか今日へ落とす。 */
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: BatchPage,
});

/**
 * 渡す日付を決めて HouseholdDay に渡す。このファイルでは取得しない。
 * 優先は URL の date、次に暮らし帳が hold している日、最後は今日（JST）。
 * 共有を変えるなら peekCalorieState。ロック日数は formula.ts の CALORIE_EDIT_DAYS。
 */
function BatchPage() {
  const { date } = Route.useSearch();
  const shown = date ?? peekCalorieState()?.date ?? todayJst();
  return (
    <Protected>
      <HouseholdDay date={shown} />
    </Protected>
  );
}
