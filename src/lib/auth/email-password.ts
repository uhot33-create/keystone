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

export const emailAndPasswordEnabled = true;

export const emailAndPasswordConfig = {
  enabled: true as const,
  revokeSessionsOnPasswordReset: true,
  sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
    await sendPasswordResetEmail(user.email, url);
  },
};
