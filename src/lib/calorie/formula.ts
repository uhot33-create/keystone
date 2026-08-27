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

export const FOOD_UNITS = ["g", "個", "杯", "袋", "本"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

export const TREAT_RATIOS = [
  { value: 0.05, label: "5%" },
  { value: 0.1, label: "10%" },
  { value: 0.15, label: "15%" },
  { value: 0.2, label: "20%" },
] as const;

export function isLifeStageId(value: string): value is LifeStageId {
  return LIFE_STAGES.some((stage) => stage.id === value);
}

export function factorFor(stage: string): number {
  return LIFE_STAGES.find((item) => item.id === stage)?.factor ?? 1.6;
}

/** Resting Energy Requirement: 70 × (ideal kg)^0.75 */
export function restingEnergy(idealKg: number): number {
  if (!(idealKg > 0)) return 0;
  return 70 * idealKg ** 0.75;
}

export function dailyEnergy(idealKg: number, stage: string): number {
  return Math.round(restingEnergy(idealKg) * factorFor(stage));
}

export function splitMealsAndTreats(targetKcal: number, treatRatio: number) {
  const ratio = Math.min(0.3, Math.max(0, treatRatio));
  const treatKcal = Math.round(targetKcal * ratio);
  const mealKcal = Math.max(0, targetKcal - treatKcal);
  return { mealKcal, treatKcal };
}

export function quantityForBudget(kcalPerServing: number, servingAmount: number, budgetKcal: number): number {
  if (!(kcalPerServing > 0) || !(servingAmount > 0) || !(budgetKcal > 0)) return 0;
  const kcalPerUnit = kcalPerServing / servingAmount;
  return budgetKcal / kcalPerUnit;
}

export function formatQuantity(quantity: number, unit: string): string {
  if (!(quantity > 0) || !Number.isFinite(quantity)) return "—";
  if (unit === "g") return `${Math.round(quantity)}g`;
  const rounded = Math.round(quantity * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${unit}`;
}

export function suggestedStage(currentKg: number, idealKg: number): LifeStageId | null {
  if (!(currentKg > 0) || !(idealKg > 0)) return null;
  if (currentKg > idealKg * 1.05) return "weight_loss";
  if (currentKg < idealKg * 0.95) return "weight_gain";
  return null;
}

export function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function formatJaDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayJa(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
}
