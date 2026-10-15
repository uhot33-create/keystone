/**
 * 前回見たバッジと比べて、新しく付いたものだけ祝う。
 * 初回は今の数字を覚えるだけで、過去分は祝わない。
 */
import type { SmokingBadges } from "@/lib/smoking/types";
import { VERY_PER_WONDERFUL } from "@/lib/smoking/badges";

const SEEN_KEY = "smoking-cheers-seen";

export type Cheer = {
  title: string;
  line: string;
};

function readSeen(): SmokingBadges | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SmokingBadges;
    if (typeof parsed.lifetimeNice !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function markCheersSeen(badges: SmokingBadges) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SEEN_KEY, JSON.stringify(badges));
}

/** 見ていない達成。記録が無い最初の一回は、今の到達を一つだけ出す。 */
export function pendingCheers(badges: SmokingBadges): Cheer[] {
  const before = readSeen();
  if (!before) return currentCheer(badges);
  return cheersSince(before, badges);
}

function currentCheer(badges: SmokingBadges): Cheer[] {
  if (badges.lifetimeNice <= 0 && badges.streak <= 0) return [];
  if (badges.wonderfulCount > 0) {
    return [{ title: "とっても素敵", line: `${badges.wonderfulCount}個まで来ています。連続${badges.streak}日です。` }];
  }
  if (badges.veryNiceCount > 0) {
    return [{ title: "ベリーナイス", line: `あと${VERY_PER_WONDERFUL - badges.veryNiceCount}個で、とっても素敵です。` }];
  }
  if (badges.streak > 0) {
    return [{ title: "ナイス", line: `連続${badges.streak}日、限度を超えていません。` }];
  }
  return [{ title: "ナイス", line: `これまで${badges.lifetimeNice}日、限度内でした。` }];
}

export function cheersSince(before: SmokingBadges, after: SmokingBadges): Cheer[] {
  const out: Cheer[] = [];
  if (!before.hundredEarned && after.hundredEarned) {
    out.push({ title: "百日", line: "限度内の日が100日になりました。" });
  } else if (!before.monthEarned && after.monthEarned) {
    out.push({ title: "ひと月", line: "30日、続いています。" });
  } else if (!before.weekEarned && after.weekEarned) {
    out.push({ title: "一週間", line: "7日、続いています。" });
  }

  if (after.wonderfulCount > before.wonderfulCount) {
    out.push({ title: "とっても素敵", line: "ベリーナイスが6つそろいました。" });
  } else if (after.veryNiceCount > before.veryNiceCount) {
    out.push({ title: "ベリーナイス", line: "ナイスが30日分そろいました。" });
  }

  if (after.quietWeekCount > before.quietWeekCount) {
    out.push({ title: "静かな週", line: "1本も吸わない日が7日続きました。" });
  }
  if (!before.startEarned && after.startEarned) {
    out.push({ title: "スタート", line: "初めてのナイスです。" });
  }

  const added = after.lifetimeNice - before.lifetimeNice;
  if (added > 0 && out.length === 0) {
    const zeros = after.zeroCount - before.zeroCount;
    const line =
      zeros > 0 && zeros === added
        ? added === 1
          ? "1本も吸いませんでした。"
          : `${added}日、1本も吸いませんでした。`
        : added === 1
          ? `限度を超えませんでした。連続${after.streak}日です。`
          : `ナイスが${added}個付きました。連続${after.streak}日です。`;
    out.push({ title: "ナイス", line });
  }

  return out.slice(0, 3);
}
