export function toJapaneseAuthError(err: unknown): string {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid") &&
    (lower.includes("password") || lower.includes("email") || lower.includes("credentials"))
  ) {
    return "メールアドレスまたはパスワードが正しくありません";
  }
  if (
    lower.includes("already") ||
    lower.includes("exists") ||
    lower.includes("registered") ||
    lower.includes("unique")
  ) {
    return "このメールアドレスはすでに登録されています";
  }
  if (lower.includes("too short") || lower.includes("min")) {
    return "パスワードは8文字以上にしてください";
  }
  if (lower.includes("user not found") || lower.includes("not found")) {
    return "このメールアドレスは登録されていません";
  }

  return message || "処理に失敗しました。時間をおいて再度お試しください。";
}
