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

export type CalorieState = {
  date: string;
  dog: DogProfile;
  foods: DogFood[];
  logs: CalorieLog[];
  week: DayTotal[];
};
