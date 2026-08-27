export type SmokingState = {
  dailyLimit: number;
  remaining: number;
  periodStartedAt: string;
  lastSmokedAt: string | null;
  resetsAt: string;
};
