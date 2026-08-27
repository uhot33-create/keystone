const JST = "Asia/Tokyo";

export function todayJst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function ageFromBirthday(iso: string, today = todayJst()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return Math.max(0, age);
}

export function formatAge(years: number | null | undefined): string | null {
  if (years == null || !Number.isFinite(years)) return null;
  return `${Math.max(0, Math.round(years))}歳`;
}

export function displayAge(memo: { ageYears: number | null; birthday: string | null }): string | null {
  if (memo.ageYears != null) return formatAge(memo.ageYears);
  if (memo.birthday) return formatAge(ageFromBirthday(memo.birthday));
  return null;
}

export function formatJaSlashDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

export function isFutureDate(iso: string, today = todayJst()): boolean {
  return iso > today;
}
