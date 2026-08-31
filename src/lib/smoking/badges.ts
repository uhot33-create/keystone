import type { SmokingBadges } from "./types";
import { jstDateKey, startOfJstDayIso } from "./period";

export const NICE_PER_VERY = 30;
export const VERY_PER_WONDERFUL = 6;

export function emptyBadges(): SmokingBadges {
  return {
    niceCount: 0,
    veryNiceCount: 0,
    wonderfulCount: 0,
    lastEvaluatedOn: null,
    lifetimeNice: 0,
    streak: 0,
    zeroStreak: 0,
    lightCount: 0,
    zeroCount: 0,
    quietWeekCount: 0,
    recoverCount: 0,
    limitDownCount: 0,
    startEarned: false,
    weekEarned: false,
    monthEarned: false,
    hundredEarned: false,
    lastWasExceeded: false,
  };
}

export function convertStoredNices(badges: SmokingBadges): SmokingBadges {
  let niceCount = Math.max(0, badges.niceCount);
  let veryNiceCount = Math.max(0, badges.veryNiceCount);
  let wonderfulCount = Math.max(0, badges.wonderfulCount);
  veryNiceCount += Math.floor(niceCount / NICE_PER_VERY);
  niceCount %= NICE_PER_VERY;
  wonderfulCount += Math.floor(veryNiceCount / VERY_PER_WONDERFUL);
  veryNiceCount %= VERY_PER_WONDERFUL;
  return { ...badges, niceCount, veryNiceCount, wonderfulCount };
}

export function applyClosedDay(
  badges: SmokingBadges,
  day: { skipped: boolean; exceeded: boolean; remaining: number; dailyLimit: number },
): SmokingBadges {
  const next = { ...badges };
  const success = day.skipped || !day.exceeded;
  const zero = success && (day.skipped || day.remaining >= day.dailyLimit);
  const light = success && (day.skipped || day.remaining * 2 >= day.dailyLimit);

  if (success) {
    next.niceCount += 1;
    next.lifetimeNice += 1;
    next.streak += 1;
    if (next.lastWasExceeded) next.recoverCount += 1;
    next.lastWasExceeded = false;
    if (next.lifetimeNice >= 1) next.startEarned = true;
    if (next.streak >= 7) next.weekEarned = true;
    if (next.streak >= 30) next.monthEarned = true;
    if (next.lifetimeNice >= 100) next.hundredEarned = true;
  } else {
    next.streak = 0;
    next.lastWasExceeded = true;
  }

  if (zero) {
    next.zeroCount += 1;
    next.zeroStreak += 1;
    if (next.zeroStreak > 0 && next.zeroStreak % 7 === 0) next.quietWeekCount += 1;
  } else {
    next.zeroStreak = 0;
  }

  if (light) next.lightCount += 1;
  return convertStoredNices(next);
}

export function addJstDays(dateKey: string, days: number): string {
  const start = Date.parse(`${dateKey}T00:00:00+09:00`);
  return jstDateKey(start + days * 24 * 60 * 60 * 1000);
}

export function yesterdayJst(now = Date.now()): string {
  return addJstDays(jstDateKey(now), -1);
}

export function eachJstDay(fromExclusive: string, toInclusive: string): string[] {
  const days: string[] = [];
  let cursor = addJstDays(fromExclusive, 1);
  let guard = 0;
  while (cursor <= toInclusive && guard < 400) {
    days.push(cursor);
    cursor = addJstDays(cursor, 1);
    guard += 1;
  }
  return days;
}

export function startOfEvaluatedDayIso(dateKey: string): string {
  return startOfJstDayIso(Date.parse(`${dateKey}T12:00:00+09:00`));
}
