export async function sendPasswordResetEmail(to: string, url: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESET_EMAIL_FROM?.trim() || "暮らし帳 <beth.t@example.com>";
  if (!key) {
    throw new Error("パスワード再設定メールの送信設定がありません（RESEND_API_KEY）");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "暮らし帳のパスワード再設定",
      html: [
        "<p>パスワード再設定の依頼を受け付けました。</p>",
        `<p><a href="${url}">こちらを開いて新しいパスワードを設定</a>してください。</p>`,
        "<p>このメールに覚えがない場合は、無視して問題ありません。リンクの有効期限は1時間です。</p>",
      ].join(""),
      text: `パスワード再設定の依頼を受け付けました。\n${url}\n覚えがない場合は無視してください。有効期限は1時間です。`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail ? `メールを送れませんでした（${detail.slice(0, 120)}）` : "メールを送れませんでした");
  }
}
