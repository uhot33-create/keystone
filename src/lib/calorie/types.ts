export type FoodKind = "food" | "treat";
export type LogKind = "food" | "treat" | "other";

export type DogProfile = {
  id: number;
  name: string;
  currentWeightKg: number;
  idealWeightKg: number;
  lifeStage: string;
  treatRatio: number;
};

export type DogFood = {
  id: number;
  name: string;
  kind: FoodKind;
  kcal: number;
  amount: number;
  unit: string;
  usualQty: number;
};

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

export type DayTotal = {
  date: string;
  total: number;
};

export type TrendGrain = "day" | "week" | "month" | "year";

export const TREND_GRAINS: { id: TrendGrain; label: string }[] = [
  { id: "day", label: "日" },
  { id: "week", label: "週" },
  { id: "month", label: "月" },
  { id: "year", label: "年" },
];

export type DayTrend = {
  date: string;
  label: string;
  start: string;
  end: string;
  kcal: number;
  weightKg: number | null;
};

export type CalorieState = {
  date: string;
  dog: DogProfile;
  foods: DogFood[];
  logs: CalorieLog[];
  week: DayTotal[];
  trend: DayTrend[];
  trends: Record<TrendGrain, DayTrend[]>;
  todayWeightKg: number | null;
};
