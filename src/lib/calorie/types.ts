/**
 * カロリー機能で画面とサーバーが受け渡す形です。フィールド名を変えるときは
 * api.ts の変換（mapDog など）と、各パネルの参照をセットで直してください。
 * 犬は DogProfile、登録フードは DogFood、定番は CalorieStaple、1食の記録は CalorieLog。
 * グラフの1点は DayTrend。画面全体のまとまりが CalorieState です。
 * グラフ切替の文言「日／週／月／年」は TREND_GRAINS です。ここだけ変えればボタンの文字が変わります。
 * SQLの列名とは別物です（例: current_weight_kg は currentWeightKg に直してから渡します）。
 */
/** 登録フードの種類。food はごはん、treat はおやつです。 */
export type FoodKind = "food" | "treat";
/** 1件の記録の種類。other はごはん・おやつ以外（手入力など）です。 */
export type LogKind = "food" | "treat" | "other";

/** 犬1頭分。lifeStage は LIFE_STAGES の id、treatRatio は 0.1 なら10%です。 */
export type DogProfile = {
  id: number;
  name: string;
  currentWeightKg: number;
  idealWeightKg: number;
  lifeStage: string;
  treatRatio: number;
};

/** dog_foods の1行。kcal はその amount（例: 100g）あたりのカロリーです。 */
export type DogFood = {
  id: number;
  name: string;
  kind: FoodKind;
  kcal: number;
  amount: number;
  unit: string;
};

/** 定番ボタン1つ。foodId のフードを qty だけ、ワンタップで記録します。並びはサーバーの sort_order 順です。 */
export type CalorieStaple = {
  id: number;
  foodId: number;
  qty: number;
};

/** その日に食べた1件。kcal は保存時点で小数第1位までに切り捨て済みです。 */
export type CalorieLog = {
  id: number;
  date: string;
  label: string;
  kcal: number;
  kind: LogKind;
  foodId: number | null;
  amount: number | null;
  unit: string | null;
};

/** 日付とその日の合計kcal。いまの画面ではあまり使っていません。 */
export type DayTotal = {
  date: string;
  total: number;
};

/** グラフの粒度。day / week / month / year のどれかです。 */
export type TrendGrain = "day" | "week" | "month" | "year";

/** グラフ上の切替ボタンです。label を変えると「日／週／月／年」の文字だけ変わります。id は変えないでください。 */
export const TREND_GRAINS: { id: TrendGrain; label: string }[] = [
  { id: "day", label: "日" },
  { id: "week", label: "週" },
  { id: "month", label: "月" },
  { id: "year", label: "年" },
];

/**
 * グラフの1点です。kcal はその期間の合計、guideKcal は点線の目安（未計算なら null）。
 * weightKg は期末の体重、walkKm は期間中の散歩距離です。
 */
export type DayTrend = {
  date: string;
  label: string;
  start: string;
  end: string;
  kcal: number;
  guideKcal: number | null;
  weightKg: number | null;
  walkKm: number;
};

/**
 * 画面が持つまとまりです。date は見ている日、dog は選択中、dogs は一覧。
 * foods / staples / logs はその犬のもの。trends は日・週・月・年のグラフです。
 */
export type CalorieState = {
  date: string;
  dog: DogProfile;
  dogs: DogProfile[];
  foods: DogFood[];
  staples: CalorieStaple[];
  logs: CalorieLog[];
  week: DayTotal[];
  trend: DayTrend[];
  trends: Record<TrendGrain, DayTrend[]>;
  todayWeightKg: number | null;
};
