/**
 * 喫煙画面とサーバーが共有する型。
 * 画面は /smoking。SmokingState が残りと上限、SmokingBadges が印の数。
 * exceeded が true の日はナイスが付かない。resetsAt は次の日本時間0時。
 * 項目を増やすときは smoking_settings / smoking_badges の列と api.ts も直す。
 */
/** バッチのカウンタ。連続日数や「獲得済み」フラグを含む。 */
export type SmokingBadges = {
  niceCount: number;
  veryNiceCount: number;
  wonderfulCount: number;
  lastEvaluatedOn: string | null;
  lifetimeNice: number;
  streak: number;
  zeroStreak: number;
  lightCount: number;
  zeroCount: number;
  quietWeekCount: number;
  recoverCount: number;
  limitDownCount: number;
  startEarned: boolean;
  weekEarned: boolean;
  monthEarned: boolean;
  hundredEarned: boolean;
  lastWasExceeded: boolean;
};

/** 今日の残り本数と、次のリセット時刻、バッジ。 */
export type SmokingState = {
  dailyLimit: number;
  remaining: number;
  periodStartedAt: string;
  lastSmokedAt: string | null;
  resetsAt: string;
  exceeded: boolean;
  badges: SmokingBadges;
};
