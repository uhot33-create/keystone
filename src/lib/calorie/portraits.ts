/**
 * メニューの犬と人の絵テンプレート。
 * チワワ／スムースだけはカロリー段階の4枚（saburo.ts）を使う。ほかの犬種は1枚。
 * 今のさぶろうの絵は chihuahua-smooth-wr。今の人の絵は woman。
 */
export const DEFAULT_DOG_PORTRAIT = "chihuahua-smooth-wr";
export const DEFAULT_PERSON_PORTRAIT = "woman";

export const DOG_PORTRAITS = [
  { id: "chihuahua-smooth-wr", label: "チワワ／スムース（ホワイト・レッド）", src: "/calorie/saburo/01-standard.jpg", stages: true },
  { id: "toy-poodle", label: "トイプードル", src: "/calorie/portraits/dogs/toy-poodle.jpg", stages: false },
  { id: "pomeranian", label: "ポメラニアン", src: "/calorie/portraits/dogs/pomeranian.jpg", stages: false },
  { id: "dachshund", label: "ミニチュアダックスフンド", src: "/calorie/portraits/dogs/dachshund.jpg", stages: false },
  { id: "yorkie", label: "ヨークシャーテリア", src: "/calorie/portraits/dogs/yorkie.jpg", stages: false },
  { id: "maltese", label: "マルチーズ", src: "/calorie/portraits/dogs/maltese.jpg", stages: false },
  { id: "frenchie", label: "フレンチブルドッグ", src: "/calorie/portraits/dogs/frenchie.jpg", stages: false },
  { id: "pug", label: "パグ", src: "/calorie/portraits/dogs/pug.jpg", stages: false },
  { id: "cavalier", label: "キャバリア", src: "/calorie/portraits/dogs/cavalier.jpg", stages: false },
  { id: "beagle", label: "ビーグル", src: "/calorie/portraits/dogs/beagle.jpg", stages: false },
  { id: "shiba", label: "柴犬", src: "/calorie/portraits/dogs/shiba.jpg", stages: false },
  { id: "corgi", label: "コーギー", src: "/calorie/portraits/dogs/corgi.jpg", stages: false },
  { id: "golden", label: "ゴールデンレトリバー", src: "/calorie/portraits/dogs/golden.jpg", stages: false },
  { id: "mix", label: "ミックス", src: "/calorie/portraits/dogs/mix.jpg", stages: false },
] as const;

export const PERSON_PORTRAITS = [
  { id: "girl", label: "女の子", src: "/calorie/portraits/people/girl.jpg" },
  { id: "boy", label: "男の子", src: "/calorie/portraits/people/boy.jpg" },
  { id: "woman", label: "大人（女性）", src: "/calorie/person.jpg" },
  { id: "man", label: "大人（男性）", src: "/calorie/portraits/people/man.jpg" },
  { id: "wild-woman", label: "ワイルドな大人（女性）", src: "/calorie/portraits/people/wild-woman.jpg" },
  { id: "wild-man", label: "ワイルドな大人（男性）", src: "/calorie/portraits/people/wild-man.jpg" },
  { id: "obasan", label: "おばさん", src: "/calorie/portraits/people/obasan.jpg" },
  { id: "ojisan", label: "おじさん", src: "/calorie/portraits/people/ojisan.jpg" },
  { id: "elder-woman", label: "老人（女性）", src: "/calorie/portraits/people/elder-woman.jpg" },
  { id: "elder-man", label: "老人（男性）", src: "/calorie/portraits/people/elder-man.jpg" },
] as const;

export type DogPortraitId = (typeof DOG_PORTRAITS)[number]["id"];
export type PersonPortraitId = (typeof PERSON_PORTRAITS)[number]["id"];

export function isDogPortrait(value: string): value is DogPortraitId {
  return DOG_PORTRAITS.some((item) => item.id === value);
}

export function isPersonPortrait(value: string): value is PersonPortraitId {
  return PERSON_PORTRAITS.some((item) => item.id === value);
}

/** チワワ／スムースは段階の絵、ほかの犬種はテンプレート1枚。 */
export function dogMenuSrc(id: string | null | undefined, stageSrc: string): string {
  const item = DOG_PORTRAITS.find((portrait) => portrait.id === id) ?? DOG_PORTRAITS[0];
  return item.stages ? stageSrc : item.src;
}

export function personMenuSrc(id: string | null | undefined): string {
  return PERSON_PORTRAITS.find((portrait) => portrait.id === id)?.src ?? PERSON_PORTRAITS[2].src;
}
