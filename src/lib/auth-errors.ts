export function toJapaneseAuthError(err: unknown): string {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err ?? "");
  const lower = message.toLowerCase();

  if (lower.includes("current password")) {
    return "現在のパスワードが正しくありません";
  }
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
  if (lower.includes("reset password isn't enabled") || lower.includes("reset_password_disabled")) {
    return "パスワード再設定の準備ができていません";
  }
  if (lower.includes("invalid_token") || (lower.includes("token") && (lower.includes("invalid") || lower.includes("expired")))) {
    return "再設定用のリンクが無効か、期限切れです。もう一度メールを送ってください";
  }
  if (lower.includes("resend") || lower.includes("メール")) {
    return message || "メールを送れませんでした";
  }

  return message || "処理に失敗しました。時間をおいて再度お試しください。";
}
