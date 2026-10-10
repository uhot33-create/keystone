/**
 * メールとパスワードでのログイン設定。今は有効（true）。
 * 止めるときは emailAndPasswordEnabled を false にする。server.ts は書き換えない。
 * 再設定メールは send-reset-mail.ts。RESEND_API_KEY と RESET_EMAIL_FROM が必要。
 */
/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT rewrite `server.ts` for this — that file is frozen pre-wired config.
 * Password reset mail is wired through `emailAndPasswordConfig` below.
 */
import { sendPasswordResetEmail } from "./send-reset-mail";

/** true のときメール＋パスワードを使う。false にするとこの機能だけ止まる。 */
export const emailAndPasswordEnabled = true;

/** Better Auth に渡す設定。再設定時は他セッションも無効にし、メールを送る。 */
export const emailAndPasswordConfig = {
  enabled: true as const,
  revokeSessionsOnPasswordReset: true,
  sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
    await sendPasswordResetEmail(user.email, url);
  },
};
