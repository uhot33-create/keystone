export const APP_NAME = "暮らし帳";
export const APP_TAGLINE = "毎日を、静かに整える";

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
] as const;
