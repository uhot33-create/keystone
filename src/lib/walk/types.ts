/**
 * お散歩カードの型と、画面で使う選択肢。
 * 一覧・新規・編集・検索 URL がこの形を共有する。
 * 並びの追加や文言は SORT_OPTIONS。性別の選択肢は SEX_OPTIONS。
 * 画像枚数の上限は MAX_MEMO_IMAGES。検索の初期値は DEFAULT_WALK_SEARCH。
 * 年齢などの入力ルールは api.ts。検索の実装は filter.ts。
 */

/**
 * 性別のプルダウン。空は未選択。値を増やすなら api.ts の asSex と zod も合わせる。
 * 画面は新規・編集。保存先は memos.sex。ラベルが画面の文言。
 */
export const SEX_OPTIONS = [
  { value: "", label: "未選択" },
  { value: "オス", label: "オス" },
  { value: "メス", label: "メス" },
  { value: "不明", label: "不明" },
] as const;

/**
 * 保存できる性別。未選択は null。空文字はフォームの未選択で、保存時に null にする。
 * 画面は新規・編集。増やすなら SEX_OPTIONS と api.ts の asSex・zod。
 */
export type SexValue = "オス" | "メス" | "不明";

/**
 * 一覧の並び順。value を増やすなら filter.ts の switch も足す。
 * 画面は /dogfriend の MemoToolbar。URL の sort はこの value。
 * 初期値は DEFAULT_WALK_SEARCH の name_asc。
 */
export const SORT_OPTIONS = [
  { value: "name_asc", label: "名前昇順" },
  { value: "name_desc", label: "名前降順" },
  { value: "last_met_desc", label: "最後に会った日が新しい順" },
  { value: "last_met_asc", label: "最後に会った日が古い順" },
  { value: "created_desc", label: "追加が新しい順" },
  { value: "age_desc", label: "年齢が高い順" },
  { value: "age_asc", label: "年齢が低い順" },
] as const;

/**
 * URL の sort に載る値。SORT_OPTIONS の value だけ。
 * 画面は /dogfriend。不正な値は一覧が名前昇順に戻す（isSortKey）。
 */
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

/**
 * 犬種マスタの1行。画面は一覧の絞り込みと新規・編集の種類。
 * 表は dog_breeds。初期データは api.ts の BREED_SEED。並びは sortOrder。
 */
export type DogBreed = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * 色マスタの1行。画面は新規・編集の色。表は dog_colors。
 * 初期データは api.ts の COLOR_SEED（表が空のときだけ）。並びは sortOrder。
 */
export type DogColor = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * 1 枚のカードに置ける画像数。フォームの枠・保存上限・カバー位置がこれ。
 * 画面は新規・編集。表は memos.images。変えると枠の数と zod の max が変わる。
 * 案内文は image.ts の IMAGE_HINT（「3枚」の文字もそこ）。
 */
export const MAX_MEMO_IMAGES = 3;

/**
 * カードに付く画像1枚。本画像は url（非公開 Blob）。一覧は thumbData か公開 thumbUrl。
 * 画面は新規・編集と一覧。保存は memos.images の jsonb。枚数は MAX_MEMO_IMAGES。
 * サムネの作りは image.ts と api.ts。表示 URL は image.ts の walkMemoImageSrc。
 */
export type MemoImage = {
  url: string;
  pathname: string | null;
  thumbUrl: string | null;
  thumbPathname: string | null;
  thumbPublic?: boolean;
  thumbData?: string | null;
};

/**
 * お散歩カード1件。一覧・編集がこの形。表は memos（犬種名・色名は結合）。
 * 年齢の表示は age.ts。検索は filter.ts。画像の枚数は images と coverIndex。
 * 項目を足すなら api.ts の mapMemo と memoInput、フォームの Draft も合わせる。
 */
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
  /**
   * 直前の最後に会った日。次に日付を変えるまで残す。
   * 更新時は last_met_on が変わるときだけ、いまの last_met_on をここへ移す（api.ts の touch / update）。
   * 戻すと last と prev を入れ替える（restoreWalkMemoMet）。画面の「○に戻す」は memo-card と memo-form。
   */
  prevLastMetOn: string | null;
  /** 虹渡り。true だと一覧の肉球を出さず、touchWalkMemoMet も更新しない。列は memos.rainbow_bridge。 */
  rainbowBridge: boolean;
  /** 虹渡りにした日。rainbowBridge が false のときは保存で null。 */
  rainbowBridgeOn: string | null;
  images: MemoImage[];
  /** 「一覧に表示」の位置。0 始まり。画像が無いときは 0。列は memos.cover_index。 */
  coverIndex: number;
  imageUrl: string | null;
  imagePathname: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * 一覧 URL の検索条件。q は名前・飼い主などの語、sort は SORT_OPTIONS、breed は犬種 id。
 * 画面は /dogfriend。絞り込みは filter.ts の filterMemos。空の breed はすべて。
 */
export type WalkSearch = {
  q: string;
  sort: SortKey;
  breed: string;
};

/**
 * 一覧を開いたときの検索。名前昇順・全犬種・検索語なし。
 * 画面は /dogfriend と、保存後に戻るリンク。並びを変えるなら sort。
 * 不正な sort の戻り先も名前昇順（dogfriend.index の validateSearch）。
 */
export const DEFAULT_WALK_SEARCH: WalkSearch = {
  q: "",
  sort: "name_asc",
  breed: "",
};

/**
 * 新規・更新でサーバーへ送る中身。id は更新側だけ足す。
 * 画面は MemoForm。検証は api.ts の memoInput。空の飼い主・日付は null。
 * 年齢は誕生日があるとサーバーが ageFromBirthday で上書きする。
 */
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
