/**
 * 机パネルのデータの形と、占いの選択肢。
 * 画面は DeskPanel。表示のオンオフ id は visibility.ts の DESK_ITEMS。
 * 占いの種類は FORTUNE_KINDS。星座の id は朝日新聞の URL（/uranai/12seiza/{id}.html）。
 * 血液型・干支の点数は1〜5。星座の span は期間のメモ（選択肢のラベルには使わない）。
 */
/** 占いの種類。id を増やすときは取得処理（desk/api.ts）も足す。 */
export const FORTUNE_KINDS = [
  { id: "zodiac", label: "12星座" },
  { id: "blood", label: "血液型" },
  { id: "eto", label: "干支" },
] as const;

/** FORTUNE_KINDS の id。zodiac / blood / eto。 */
export type FortuneKind = (typeof FORTUNE_KINDS)[number]["id"];

/** 12星座。id は外部サイトのパスに使う。span は期間のメモ。 */
export const ZODIAC_OPTIONS = [
  { id: "aries", label: "おひつじ座", span: "3/21–4/19" },
  { id: "taurus", label: "おうし座", span: "4/20–5/20" },
  { id: "gemini", label: "ふたご座", span: "5/21–6/21" },
  { id: "cancer", label: "かに座", span: "6/22–7/22" },
  { id: "leo", label: "しし座", span: "7/23–8/22" },
  { id: "virgo", label: "おとめ座", span: "8/23–9/22" },
  { id: "libra", label: "てんびん座", span: "9/23–10/23" },
  { id: "scorpio", label: "さそり座", span: "10/24–11/22" },
  { id: "sagittarius", label: "いて座", span: "11/23–12/21" },
  { id: "capricorn", label: "やぎ座", span: "12/22–1/19" },
  { id: "aquarius", label: "みずがめ座", span: "1/20–2/18" },
  { id: "pisces", label: "うお座", span: "2/19–3/20" },
] as const;

/** 血液型占いの選択肢。 */
export const BLOOD_OPTIONS = [
  { id: "a", label: "A型" },
  { id: "b", label: "B型" },
  { id: "o", label: "O型" },
  { id: "ab", label: "AB型" },
] as const;

/** 干支占いの選択肢。id は保存用、label が画面の文字。 */
export const ETO_OPTIONS = [
  { id: "ne", label: "子" },
  { id: "ushi", label: "丑" },
  { id: "tora", label: "寅" },
  { id: "u", label: "卯" },
  { id: "tatsu", label: "辰" },
  { id: "mi", label: "巳" },
  { id: "uma", label: "午" },
  { id: "hitsuji", label: "未" },
  { id: "saru", label: "申" },
  { id: "tori", label: "酉" },
  { id: "inu", label: "戌" },
  { id: "i", label: "亥" },
] as const;

/** 「今日は何の日」1件分。 */
export type OnThisDay = {
  dateLabel: string;
  items: string[];
  source: string;
};

/** 格言。 */
export type DailyQuote = {
  text: string;
  author: string;
  source: string;
};

/** 小話と犬の豆知識で共用。sourceUrl があるとリンクになる。 */
export type DailyStory = {
  title: string;
  text: string;
  source: string;
  sourceUrl?: string;
};

/** 犬ネタ1件。 */
export type DogNewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
};

/** 犬ネタのまとまり。 */
export type DogNews = {
  items: DogNewsItem[];
  source: string;
};

/** 占いの1行。score は5点満点、null なら星を出さない。 */
export type FortuneLine = {
  label: string;
  score: number | null;
  text: string;
};

/** 占い1件。kind と key は選んだ種類と項目 id。 */
export type DailyFortune = {
  kind: FortuneKind;
  key: string;
  title: string;
  lines: FortuneLine[];
  source: string;
};

/** getDesk の戻り。取れなかった項目は null、理由は errors。 */
export type DeskState = {
  onThisDay: OnThisDay | null;
  quote: DailyQuote | null;
  story: DailyStory | null;
  dogFact: DailyStory | null;
  dogNews: DogNews | null;
  fortune: DailyFortune | null;
  errors: string[];
};
