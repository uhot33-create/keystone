export const FORTUNE_KINDS = [
  { id: "zodiac", label: "12星座" },
  { id: "blood", label: "血液型" },
  { id: "eto", label: "干支" },
] as const;

export type FortuneKind = (typeof FORTUNE_KINDS)[number]["id"];

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

export const BLOOD_OPTIONS = [
  { id: "a", label: "A型" },
  { id: "b", label: "B型" },
  { id: "o", label: "O型" },
  { id: "ab", label: "AB型" },
] as const;

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

export type OnThisDay = {
  dateLabel: string;
  items: string[];
  source: string;
};

export type DailyQuote = {
  text: string;
  author: string;
  source: string;
};

export type FortuneLine = {
  label: string;
  score: number | null;
  text: string;
};

export type DailyFortune = {
  kind: FortuneKind;
  key: string;
  title: string;
  lines: FortuneLine[];
  source: string;
};

export type DeskState = {
  onThisDay: OnThisDay | null;
  quote: DailyQuote | null;
  fortune: DailyFortune | null;
  errors: string[];
};
