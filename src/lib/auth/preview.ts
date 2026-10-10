/**
 * ライブプレビュー専用の共有 OAuth クライアント。サーバー専用。クライアントから import しない。
 * デプロイ時は GROK_AUTH_CLIENT_ID / SECRET と GROK_AUTH_ISSUER がこれらを上書きする。
 * 許可ホストは PREVIEW_ALLOWED_HOSTS（*.grok-sandbox.com）。発行元の既定は GROK_ISSUER_DEFAULT。
 */
/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`
 * (broker: `app-builder-deployer/auth/src/preview-oauth.ts`). Baking it here lets
 * the live preview do REAL sign-in — no demo/mock users — with no platform
 * injection. When deployed the deployer injects a per-app
 * `GROK_AUTH_*` that overrides these (see `server.ts`).
 *
 * These MUST equal the broker's `GROK_PREVIEW_CLIENT_ID` /
 * `GROK_PREVIEW_CLIENT_SECRET` (set in the broker's Vercel env; the broker stores
 * only the secret's `base64url(SHA-256)` hash). This is a dedicated, low-privilege
 * client (preview-only, `*.grok-sandbox.com`) — rotate it by regenerating the
 * broker env var and this constant together.
 */
/** プレビュー用クライアント id。ブローカー側の値と一致させる。 */
export const PREVIEW_CLIENT_ID = "grok_preview";
/** プレビュー用シークレット。ローテーションするときはブローカーと同時に変える。 */
export const PREVIEW_CLIENT_SECRET =
  "8bcdb7fc5a33874ad933ca568918d5790388a0795e44c4d1dea691f801b17ec5";

/** 認証ブローカーの既定 URL。GROK_AUTH_ISSUER が無いときに使う。 */
/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/** プレビューのコールバックを許すホスト。ワイルドカードは Better Auth が照合する。 */
/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
