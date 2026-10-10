/**
 * カロリー計算と日付の共通ルールです。プラン画面の必要量、今日画面の残量、
 * サーバーの保存前チェックが同じ関数を使います。
 * 1日の目安は dailyEnergy = restingEnergy（安静時）× LIFE_STAGES の factor です。
 * 摂取kcalは truncKcal（小数第1位まで、それ以下は切り捨て）に揃えます。
 * 編集ロックは CALORIE_EDIT_DAYS（14）。これより古い記録は変更できません。
 * ラベル（ステージ名、単位、おやつ%）を変えると、その選択肢の文言だけ変わります。
 */
/**
 * ライフステージごとの係数です。1日の目安 = 安静時カロリー × factor。
 * label はプラン画面の選択肢の文言。factor を上げると目標kcalが増えます。
 * id を変えると、すでに保存された dogs.life_stage と一致しなくなります。
 */
export const LIFE_STAGES = [
  { id: "puppy_young", label: "子犬（4ヶ月未満）", factor: 3.0 },
  { id: "puppy", label: "子犬（4ヶ月〜成犬）", factor: 2.0 },
  { id: "adult_intact", label: "成犬（未去勢）", factor: 1.8 },
  { id: "adult_neutered", label: "成犬（避妊・去勢済み）", factor: 1.6 },
  { id: "active", label: "よく遊ぶ・活発", factor: 2.0 },
  { id: "inactive", label: "あまり動かない", factor: 1.2 },
  { id: "senior", label: "シニア", factor: 1.4 },
  { id: "weight_loss", label: "減量したい", factor: 1.0 },
  { id: "weight_gain", label: "増量したい", factor: 1.4 },
] as const;

export type LifeStageId = (typeof LIFE_STAGES)[number]["id"];

/** フード登録で選べる単位。追加するときは api.ts の addFoodInput の enum も同じ並びに揃えてください。 */
export const FOOD_UNITS = ["g", "個", "杯", "袋", "本"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

/**
 * おやつに回す割合です。0.1 なら目標の10%。プラン画面の選択肢になります。
 * 割合を上げるほどごはんが減りおやつが増えます。0.3 を超える値は splitMealsAndTreats と保存時の zod が落とします。
 */
export const TREAT_RATIOS = [
  { value: 0.05, label: "5%" },
  { value: 0.1, label: "10%" },
  { value: 0.15, label: "15%" },
  { value: 0.2, label: "20%" },
] as const;

/** LIFE_STAGES にある id かどうか。一覧に無い文字列は不正として弾きます。 */
export function isLifeStageId(value: string): value is LifeStageId {
  return LIFE_STAGES.some((stage) => stage.id === value);
}

/** id から係数を取ります。見つからないときは 1.6（避妊・去勢済みの成犬）です。 */
export function factorFor(stage: string): number {
  return LIFE_STAGES.find((item) => item.id === stage)?.factor ?? 1.6;
}

/**
 * 安静時エネルギー（RER）です。式は 70 × (理想体重kg) の 0.75 乗。
 * 理想体重が 0 以下なら 0。70 や 0.75 を変えると、1日の目安カロリー全体が変わります。
 * Resting Energy Requirement: 70 × (ideal kg)^0.75
 */
export function restingEnergy(idealKg: number): number {
  if (!(idealKg > 0)) return 0;
  return 70 * idealKg ** 0.75;
}

/**
 * 1日の目標kcalです。安静時カロリー × ステージ係数を四捨五入します。
 * プランの表示、グラフの点線（calorie_period_guides）、今日の残量はみなこの値です。
 */
export function dailyEnergy(idealKg: number, stage: string): number {
  return Math.round(restingEnergy(idealKg) * factorFor(stage));
}

/**
 * 目標をごはんとおやつに分けます。割合は 0〜0.3 に収め、おやつ側を四捨五入、残りがごはんです。
 * 割合だけ変えても合計は目標のままです。
 */
export function splitMealsAndTreats(targetKcal: number, treatRatio: number) {
  const ratio = Math.min(0.3, Math.max(0, treatRatio));
  const treatKcal = Math.round(targetKcal * ratio);
  const mealKcal = Math.max(0, targetKcal - treatKcal);
  return { mealKcal, treatKcal };
}

/**
 * 登録時の「kcal ÷ 分量」に、食べた数量をかけて truncKcal します。
 * 例: 350kcal/100g を 30g なら 105。基準の分量を変えると記録されるkcalが変わります。
 */
export function kcalForQuantity(kcal: number, baseAmount: number, quantity: number): number {
  if (!(kcal > 0) || !(baseAmount > 0) || !(quantity > 0)) return 0;
  return truncKcal((kcal / baseAmount) * quantity);
}

/**
 * 記録の保存・合計・残り表示はみなここを通るので、桁を変えると画面のkcalがずれます。四捨五入ではありません。
 * 摂取カロリーは小数第1位まで。第2位以下は切り捨て。
 */
export function truncKcal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? -Math.trunc(-value * 10) / 10 : Math.trunc(value * 10) / 10;
}

/** 画面用のkcal文字列です。整数なら小数を出さず、そうでなければ小数1桁。計算はしません。 */
export function formatKcal(value: number): string {
  const n = truncKcal(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 予算kcalを使い切る数量です（1単位あたりのkcalで割る）。プランの「何g・何個」に使います。
 * 表示の丸めは formatQuantity 側なので、ここは生の数のまま返します。
 */
export function quantityForBudget(kcalPerServing: number, servingAmount: number, budgetKcal: number): number {
  if (!(kcalPerServing > 0) || !(servingAmount > 0) || !(budgetKcal > 0)) return 0;
  const kcalPerUnit = kcalPerServing / servingAmount;
  return budgetKcal / kcalPerUnit;
}

/** 数量の表示です。g は整数に四捨五入、それ以外は小数1桁。0以下は「—」。単位の付け方を変えるとプランと今日の表示が変わります。 */
export function formatQuantity(quantity: number, unit: string): string {
  if (!(quantity > 0) || !Number.isFinite(quantity)) return "—";
  if (unit === "g") return `${Math.round(quantity)}g`;
  const rounded = Math.round(quantity * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${unit}`;
}

/**
 * 体重の差からステージを提案します。理想の1.05倍より重いと減量、0.95倍より軽いと増量。
 * その間は提案しません。倍率を変えるとプランの「合わせる」が出る条件が変わります。
 */
export function suggestedStage(currentKg: number, idealKg: number): LifeStageId | null {
  if (!(currentKg > 0) || !(idealKg > 0)) return null;
  if (currentKg > idealKg * 1.05) return "weight_loss";
  if (currentKg < idealKg * 0.95) return "weight_gain";
  return null;
}

/** 今日の日付を日本時間の YYYY-MM-DD で返します。タイムゾーンを変えると「今日」とロック判定がずれます。 */
export function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 日付文字列を days 日ずらします。UTCの日付計算なので、日本時間でも日付が1日ずれにくいです。 */
export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/**
 * 編集できる日数です。今日からこの日数だけ遡った日以前は変更不可（その日ちょうども含む）。
 * 14 なら直近14日だけ編集でき、それより前は閲覧のみ。画面の「2週間」という文言は today-panel 側です。
 * 今日から14日より前の記録は変更不可。
 */
export const CALORIE_EDIT_DAYS = 14;

/** date が「今日 − CALORIE_EDIT_DAYS」以前なら true。今日画面は入力を止め、閲覧だけにします。 */
export function isCalorieLocked(date: string, today = todayJst()): boolean {
  return date <= shiftIsoDate(today, -CALORIE_EDIT_DAYS);
}

/** ロック中ならこの文言で保存を止めます。日数を変えてもメッセージは自動では変わりません。 */
export function assertCalorieEditable(date: string, today = todayJst()) {
  if (isCalorieLocked(date, today)) {
    throw new Error("2週間以上前の記録は変更できません");
  }
}

/** 「2026年10月10日」の形です。表示だけなので、記録の日付そのものは変わりません。 */
export function formatJaDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

/** 今日画面の日付バー用です。「10月10日（土）」の形。曜日の文字は WEEKDAYS です。 */
export function formatJaDayWeek(iso: string): string {
  const parts = iso.split("-").map(Number);
  const month = parts[1];
  const day = parts[2];
  return `${month}月${day}日（${weekdayJa(iso)}）`;
}

/** 日だけを返します（先頭の0は落とす）。グラフの軸などで使います。 */
export function dayNum(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

/** 小数1桁に四捨五入した文字列です。今日画面のフードチップ（kcal/g）の表示に使います。 */
export function trimNum(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 曜日の1文字。並びは日曜始まり（Date の getUTCDay が 0〜6）です。文字を変えると日付表示の曜日が変わります。 */
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** その日付の曜日1文字です。WEEKDAYS の並びを崩すと、違う曜日が出ます。 */
export function weekdayJa(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
}
