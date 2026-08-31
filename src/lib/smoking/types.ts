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

export type SmokingState = {
  dailyLimit: number;
  remaining: number;
  periodStartedAt: string;
  lastSmokedAt: string | null;
  resetsAt: string;
  exceeded: boolean;
  badges: SmokingBadges;
};
