export const SEX_OPTIONS = [
  { value: "", label: "未選択" },
  { value: "オス", label: "オス" },
  { value: "メス", label: "メス" },
  { value: "不明", label: "不明" },
] as const;

export type SexValue = "オス" | "メス" | "不明";

export const SORT_OPTIONS = [
  { value: "name_asc", label: "名前昇順" },
  { value: "name_desc", label: "名前降順" },
  { value: "last_met_desc", label: "最後に会った日が新しい順" },
  { value: "last_met_asc", label: "最後に会った日が古い順" },
  { value: "created_desc", label: "追加が新しい順" },
  { value: "age_desc", label: "年齢が高い順" },
  { value: "age_asc", label: "年齢が低い順" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type DogBreed = {
  id: string;
  name: string;
  sortOrder: number;
};

export type DogColor = {
  id: string;
  name: string;
  sortOrder: number;
};

export type WalkMemo = {
  id: string;
  name: string;
  ownerName: string | null;
  breedId: string | null;
  breedName: string | null;
  sex: SexValue | null;
  colorId: string | null;
  colorName: string | null;
  birthday: string | null;
  ageYears: number | null;
  note: string | null;
  lastMetOn: string | null;
  rainbowBridge: boolean;
  rainbowBridgeOn: string | null;
  imageUrl: string | null;
  imagePathname: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WalkSearch = {
  q: string;
  sort: SortKey;
  breed: string;
};

export const DEFAULT_WALK_SEARCH: WalkSearch = {
  q: "",
  sort: "name_asc",
  breed: "",
};

export type MemoInput = {
  name: string;
  ownerName: string | null;
  breedId: string | null;
  sex: SexValue | null;
  colorId: string | null;
  birthday: string | null;
  ageYears: number | null;
  note: string;
  lastMetOn: string | null;
  rainbowBridge: boolean;
  rainbowBridgeOn: string | null;
  imageUrl: string | null;
  imagePathname: string | null;
};
