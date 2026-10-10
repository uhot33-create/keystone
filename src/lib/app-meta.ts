/**
 * アプリ名と、トップに並ぶメニュー。
 * 名前・一言は APP_NAME / APP_TAGLINE。項目の追加・順番・説明は MENUS。
 * アイコンは routes/index.tsx の ICONS を同じパスで揃える。色は styles.css。
 */
/** ヘッダーとログイン画面に出す名前。 */
export const APP_NAME = "暮らし帳";
/** ログイン画面の短い説明。 */
export const APP_TAGLINE = "毎日を、静かに整える";

/** トップのメニュー。to はパス、index は番号、title と description が画面の文言。 */
export const MENUS = [
  {
    to: "/calorie",
    index: "01",
    title: "わんカロリー",
    description: "愛犬の食事とカロリーを記録する",
  },
  {
    to: "/smoking",
    index: "02",
    title: "喫煙管理",
    description: "喫煙の記録と習慣を見つめる",
  },
  {
    to: "/walk",
    index: "03",
    title: "お散歩メモ",
    description: "出会った子のカードを残す",
  },
  {
    to: "/vet",
    index: "04",
    title: "通院履歴",
    description: "病院の予定と記録を残す",
  },
  {
    to: "/cup",
    index: "05",
    title: "カップ麺",
    description: "期限と個数を管理する",
  },
] as const;
