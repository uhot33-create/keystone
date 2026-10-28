/**
 * メニューの犬と人の絵テンプレート。
 * チワワ／スムースだけはカロリー段階の4枚（saburo.ts）を使う。ほかの犬種は1枚。
 * 今のさぶろうの絵は chihuahua-smooth-wr。今の人の絵は woman。
 */
/**
 * 犬を選んでいないときの id。段階つきのさぶろう絵。変えると初期のメニュー絵が変わる。
 * 保存列は dogs.portrait_id。不明な値も mapDog がここへ落とす。
 * 別の犬種を初期にするなら、DOG_PORTRAITS にある id を入れる。
 */
export const DEFAULT_DOG_PORTRAIT = "chihuahua-smooth-wr";
/**
 * 人の絵の初期値。user_settings が空のとき、表示は personMenuSrc が大人（女性）に落とす。
 * id は PERSON_PORTRAITS。世帯で1つ。犬を替えても変わらない。
 * 初期の src を変えるなら配列の並びと personMenuSrc のフォールバックを揃える。
 */
export const DEFAULT_PERSON_PORTRAIT = "woman";

/**
 * 犬の絵一覧。id は dogs.portrait_id に保存する。stages が true のときだけ saburo.ts の4段階を使う。
 * 犬種を足すときは画像を public に置き、id を既存と被らせない。
 */
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

/**
 * 人の絵一覧。id は user_settings.person_portrait。並びは選択画面の順。
 * プロフィールの人の絵。未設定は personMenuSrc が3番目（大人・女性）に落とす。
 * id を足すときは画像を public に置き、isPersonPortrait は配列から自動で広がる。
 */
export const PERSON_PORTRAITS = [
  { id: "girl", label: "女の子", src: "/calorie/portraits/people/girl.jpg" },
  { id: "boy", label: "男の子", src: "/calorie/portraits/people/boy.jpg" },
  { id: "woman", label: "大人（女性）", src: "/calorie/person.jpg" },
  { id: "man", label: "大人（男性）", src: "/calorie/portraits/people/man.jpg" },
  { id: "wild-woman", label: "ワイルドな大人（女性）", src: "/calorie/portraits/people/wild-woman.jpg" },
  { id: "wild-man", label: "ワイルドな大人（男性）", src: "/calorie/portraits/people/wild-man.jpg" },
  { id: "obasan", label: "おばさん", src: "/calorie/portraits/people/obasan.jpg" },
  { id: "ojisan", label: "おじさん", src: "/calorie/portraits/people/ojisan.jpg" },
  { id: "wild-ojisan", label: "ワイルドなおじさん", src: "/calorie/portraits/people/wild-ojisan.jpg" },
  { id: "elder-woman", label: "老人（女性）", src: "/calorie/portraits/people/elder-woman.jpg" },
  { id: "elder-man", label: "老人（男性）", src: "/calorie/portraits/people/elder-man.jpg" },
] as const;

/**
 * DOG_PORTRAITS の id。文字列を広げるときは配列側を先に足す。
 * 保存は dogs.portrait_id。段階つきは chihuahua-smooth-wr だけ。
 * 判定は isDogPortrait。初期値は DEFAULT_DOG_PORTRAIT。
 */
export type DogPortraitId = (typeof DOG_PORTRAITS)[number]["id"];
/**
 * PERSON_PORTRAITS の id。人の絵の保存値。
 * 世帯共通の user_settings.person_portrait。犬ごとに分けない。
 * 不明な id は isPersonPortrait が false。表示の初期は personMenuSrc。
 */
export type PersonPortraitId = (typeof PERSON_PORTRAITS)[number]["id"];

/**
 * 知らない id は false。保存前のチェックは api.ts の zod がこれを使う。
 * 犬の絵 id は DOG_PORTRAITS。保存列は dogs.portrait_id。
 * 犬種を足すなら配列を先に足す。初期値は DEFAULT_DOG_PORTRAIT。
 */
export function isDogPortrait(value: string): value is DogPortraitId {
  return DOG_PORTRAITS.some((item) => item.id === value);
}

/**
 * 人の絵 id が一覧にあるか。無い値は保存できない。
 * 保存先は user_settings.person_portrait。一覧は PERSON_PORTRAITS。
 * id を足すなら配列側。未設定の表示は personMenuSrc。
 */
export function isPersonPortrait(value: string): value is PersonPortraitId {
  return PERSON_PORTRAITS.some((item) => item.id === value);
}

/**
 * メニューの犬の絵。id が stages なら stageSrc（その日のさぶろう段階）、それ以外はテンプレート1枚。
 * 不明な id は一覧の先頭。段階の切り替え規則は saburo.ts。犬種を足しても stages を true にしない限り1枚のまま。
 */
export function dogMenuSrc(id: string | null | undefined, stageSrc: string): string {
  const item = DOG_PORTRAITS.find((portrait) => portrait.id === id) ?? DOG_PORTRAITS[0];
  return item.stages ? stageSrc : item.src;
}

/**
 * 人のメニュー絵。未設定・不明な id は3番目（大人・女性、DEFAULT と同じ src）。
 * 暮らし帳と今日画面の人ボード。id は PERSON_PORTRAITS。
 * 並びを変えると初期絵がずれる。犬の段階絵は dogMenuSrc。
 */
export function personMenuSrc(id: string | null | undefined): string {
  return PERSON_PORTRAITS.find((portrait) => portrait.id === id)?.src ?? PERSON_PORTRAITS[2].src;
}
