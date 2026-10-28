/**
 * カロリー機能で画面とサーバーが受け渡す形です。フィールド名を変えるときは
 * api.ts の変換（mapDog など）と、各パネルの参照をセットで直してください。
 * 犬は DogProfile、登録フードは DogFood、定番は CalorieStaple、1食の記録は CalorieLog。
 * グラフの1点は DayTrend。画面全体のまとまりが CalorieState です。
 * グラフ切替の文言「日／週／月／年」は TREND_GRAINS です。ここだけ変えればボタンの文字が変わります。
 * SQLの列名とは別物です（例: current_weight_kg は currentWeightKg に直してから渡します）。
 * 摂取 kcal の小数第1位切り捨ては formula.ts の truncKcal。期末体重と点線の保存は summary.ts。
 */
/**
 * 登録フードの種類。food はごはん、treat はおやつです。
 * dog_foods.kind と今日画面の切り替え。記録の other は LogKind。
 * 文言を変えても保存値は変えない。選択肢は foods-panel。
 */
export type FoodKind = "food" | "treat";
/**
 * 1件の記録の種類。other はごはん・おやつ以外（手入力など）です。
 * calorie_logs.kind。画面のラベルは treat 以外をごはんにする。
 * 種類を足すなら api.ts の asLogKind と今日画面の入力も揃える。
 */
export type LogKind = "food" | "treat" | "other";

/**
 * 犬1頭分。lifeStage は LIFE_STAGES の id、treatRatio は 0.1 なら10%です。
 * dogs の1行を画面用にしたもの。絵の id は portraits.ts。
 * 列名を変えるなら api.ts の mapDog。体重の桁は小数2桁。
 */
export type DogProfile = {
  id: number;
  name: string;
  currentWeightKg: number;
  idealWeightKg: number;
  lifeStage: string;
  treatRatio: number;
  /** portraits.ts の犬テンプレート id。未設定はチワワ／スムース。 */
  portraitId: string;
};

/**
 * dog_foods の1行。kcal はその amount（例: 100g）あたりのカロリーです。
 * フードタブの登録と、今日画面のチップ。食べた分の計算は kcalForQuantity。
 * 単位を足すなら formula.ts の FOOD_UNITS と api の zod。
 */
export type DogFood = {
  id: number;
  name: string;
  kind: FoodKind;
  kcal: number;
  amount: number;
  unit: string;
};

/**
 * 定番ボタン1つ。foodId のフードを qty だけ、ワンタップで記録します。
 * 並びは calorie_staples.sort_order。今日タブの定番チップ。
 * 並びの保存は reorderCalorieStaples。kcal の切り捨ては truncKcal。
 */
export type CalorieStaple = {
  id: number;
  foodId: number;
  qty: number;
};

/**
 * まとめて入力の定番。カロリー計算に必要なフード情報も持つ。
 * 画面は household-day。元は calorie_staples と dog_foods の結合。
 * 表示の数量は formatQuantity。保存時の kcal は truncKcal。
 */
export type HouseholdStaple = {
  id: number;
  foodId: number;
  name: string;
  qty: number;
  unit: string;
  kcal: number;
  amount: number;
  kind: FoodKind;
};

/**
 * ある日の、犬1頭分の体重と定番。まとめて入力画面が使う。
 * 体重はその日の dog_weight_logs。無い日は null。平均ではない。
 * ロックは isCalorieLocked。読み込みは getHouseholdDay。
 */
export type HouseholdDogDay = {
  id: number;
  name: string;
  weightKg: number | null;
  staples: HouseholdStaple[];
};

/**
 * 毎日ではない手入れ。lastDoneOn は最後にやった日だけ残す。履歴の列は無い。
 * dog_cares。未実施の案内は出さない。おくすり画面の手入れ欄。
 * 日付の更新は markDogCare。取消は last_done_on を空に戻すだけ。
 */
export type DogCare = {
  id: number;
  name: string;
  lastDoneOn: string | null;
};
/**
 * その日の投薬。dueTime は毎日の予定時刻（HH:MM）。済か未かは dog_medicine_doses。
 * 機能追加日（medicine_added_on）当日以前は画面で「—」。時刻が空でも案内しない。
 * 判定は medicine-panel の beforeMedicineFeature と overdueMedicines。
 */
export type DogMedicine = {
  id: number;
  name: string;
  note: string;
  dueTime: string | null;
  trackedFrom: string | null;
  givenAt: string | null;
};

/**
 * その日に食べた1件。kcal は保存時点で小数第1位までに切り捨て済みです。
 * calorie_logs。今日画面と暮らし帳の記録行。切り捨ては truncKcal。
 * 2週間より前の変更は isCalorieLocked と assertCalorieEditable。
 */
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

/**
 * 日付とその日の合計kcal。いまの画面ではあまり使っていません。
 * CalorieState.week の形。グラフの点は DayTrend。
 * 合計の切り捨ては truncKcal。ここは型だけ。
 */
export type DayTotal = {
  date: string;
  total: number;
};

/**
 * グラフの粒度。day / week / month / year のどれかです。
 * 日は直近7点（WINDOW.day）。ボタン文言は TREND_GRAINS。
 * 件数を変えるなら summary.ts の WINDOW と画面の CHART_WINDOW。
 */
export type TrendGrain = "day" | "week" | "month" | "year";

/**
 * グラフ上の切替ボタンです。label を変えると「日／週／月／年」の文字だけ変わります。
 * id は変えないでください。集計の period_type と同じ文字列です。
 * 日次の件数は summary.ts の WINDOW.day（7）。画面は trend-chart。
 */
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
  medicines: DogMedicine[];
  /** ブラッシングなど。最後にやった日だけ。 */
  cares: DogCare[];
  /** app_settings.medicine_added_on。この日以前は投与状態を「—」にする。 */
  medicineAddedOn: string | null;
  logs: CalorieLog[];
  week: DayTotal[];
  trend: DayTrend[];
  trends: Record<TrendGrain, DayTrend[]>;
  todayWeightKg: number | null;
  /** portraits.ts の人テンプレート id。未設定は大人（女性）。 */
  personPortrait: string;
};
