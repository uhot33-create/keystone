/**
 * お散歩カードの型と、画面で使う選択肢。
 * 一覧・新規・編集・検索 URL がこの形を共有する。
 * 並びの追加や文言は SORT_OPTIONS。性別の選択肢は SEX_OPTIONS。
 * 画像枚数の上限は MAX_MEMO_IMAGES。検索の初期値は DEFAULT_WALK_SEARCH。
 * 年齢などの入力ルールは api.ts。検索の実装は filter.ts。
 */

/** 性別のプルダウン。空は未選択。値を増やすなら api.ts の asSex と zod も合わせる。 */
export const SEX_OPTIONS = [
  { value: "", label: "未選択" },
  { value: "オス", label: "オス" },
  { value: "メス", label: "メス" },
  { value: "不明", label: "不明" },
] as const;

export type SexValue = "オス" | "メス" | "不明";

/** 一覧の並び順。value を増やすなら filter.ts の switch も足す。 */
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

/** 1 枚のカードに置ける画像数。フォームの枠・保存上限・カバー位置がこれ。 */
export const MAX_MEMO_IMAGES = 3;

export type MemoImage = {
  url: string;
  pathname: string | null;
  thumbUrl: string | null;
  thumbPathname: string | null;
  thumbPublic?: boolean;
  thumbData?: string | null;
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
  images: MemoImage[];
  coverIndex: number;
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

/** 一覧を開いたときの検索。名前昇順・全犬種・検索語なし。 */
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
  images: MemoImage[];
  coverIndex: number;
};
