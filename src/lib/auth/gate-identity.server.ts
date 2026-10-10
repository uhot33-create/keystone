/**
 * ゲートが付ける本人確認 JWT（ヘッダー x-grok-identity）の検証。サーバー専用。
 * 有効条件は VITE_AUTH_ENABLED が false 以外、かつ GROK_PROJECT_ID があること。
 * 発行元は GROK_GATE_ORIGIN。無ければホスト名から gate.grok.me などを決める。
 * 公開鍵のキャッシュ時間は JWKS_CACHE_TTL_MS（5分）。
 */
import {
  importJWK,
  jwtVerify,
  type JWK,
  type JWTVerifyGetKey,
} from "jose";

/** 本人確認トークンが入るリクエストヘッダー名。 */
export const GATE_IDENTITY_HEADER = "x-grok-identity";
/** 公開鍵（JWKS）を取りに行くパス。発行元のオリジンに付ける。 */
export const GATE_JWKS_PATH = "/__gate/identity-key";

/** 公開鍵を覚えている時間（ミリ秒）。過ぎたら取り直す。 */
const JWKS_CACHE_TTL_MS = 300_000;

/** 検証済みの本人。sub がユーザー id。 */
export type GateIdentity = {
  sub: string;
  email: string | null;
  name: string | null;
  teamId: string | null;
};

/** ゲートが返す公開鍵の束。 */
export type GateJwks = { keys: JWK[] };

/** 公開鍵を URL から取る関数。テストでは差し替えられる。 */
export type JwksFetch = (url: string) => Promise<GateJwks | null>;

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** ゲート本人確認を使うか。認証オフ、またはプロジェクト id 無しなら false。 */
export function gateIdentityEnabled(): boolean {
  return env("VITE_AUTH_ENABLED") !== "false" && Boolean(env("GROK_PROJECT_ID"));
}

async function defaultJwksFetch(url: string): Promise<GateJwks | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      redirect: "manual",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as GateJwks;
    return Array.isArray(body?.keys) ? body : null;
  } catch {
    return null;
  }
}

const jwksCache = new Map<string, { jwks: GateJwks; fetchedAt: number }>();

/** JWT の kid に合う公開鍵を、キャッシュ付きで返す。 */
export function gateKeyResolver(
  url: string,
  jwksFetch: JwksFetch = defaultJwksFetch,
): JWTVerifyGetKey {
  return async (protectedHeader) => {
    const kid =
      typeof protectedHeader.kid === "string" ? protectedHeader.kid : undefined;
    const findKey = (jwks: GateJwks): JWK | undefined =>
      jwks.keys.find(
        (k) =>
          k.kty === "OKP" && k.crv === "Ed25519" && (!kid || k.kid === kid),
      );

    let entry = jwksCache.get(url);
    if (!entry || Date.now() - entry.fetchedAt > JWKS_CACHE_TTL_MS) {
      const jwks = await jwksFetch(url);
      if (jwks) {
        entry = { jwks, fetchedAt: Date.now() };
        jwksCache.set(url, entry);
      }
    }

    let key = entry ? findKey(entry.jwks) : undefined;
    if (!key) {
      const jwks = await jwksFetch(url);
      if (jwks) {
        entry = { jwks, fetchedAt: Date.now() };
        jwksCache.set(url, entry);
        key = findKey(jwks);
      }
    }
    if (!key) {
      throw new Error("no gate identity key matches the token kid");
    }
    return importJWK(key, "EdDSA");
  };
}

/** 検証に使う発行者と、オーディエンス（app:プロジェクトid）。 */
export type VerifyGateIdentityTokenOptions = {
  issuer: string;
  audience: string;
  getKey: JWTVerifyGetKey;
};

/** トークンを検証して本人を返す。期限切れや発行者が違うときは null。 */
export async function verifyGateIdentityToken(
  token: string,
  options: VerifyGateIdentityTokenOptions,
): Promise<GateIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, options.getKey, {
      algorithms: ["EdDSA"],
      issuer: options.issuer,
      audience: options.audience,
      requiredClaims: ["sub", "iat", "exp"],
      maxTokenAge: "10 minutes",
    });
    const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!sub) return null;
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      teamId: typeof payload.team_id === "string" ? payload.team_id : null,
    };
  } catch {
    return null;
  }
}

type GateEndpoints = { issuer: string; jwksUrl: string };

/** 環境変数か Host ヘッダーから、ゲートの発行元と公開鍵 URL を決める。 */
export function resolveGateEndpoints(headers: Headers): GateEndpoints | null {
  const explicit = env("GROK_GATE_ORIGIN");
  if (explicit) {
    const origin = explicit.replace(/\/+$/, "");
    return { issuer: origin, jwksUrl: `${origin}${GATE_JWKS_PATH}` };
  }

  const xf = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (xf || headers.get("host") || "")
    .split(":")[0]
    ?.trim()
    .toLowerCase();
  if (!host) return null;

  let issuer: string | null = null;
  if (
    host === "app-builder-testing.com" ||
    host.endsWith(".app-builder-testing.com")
  ) {
    issuer = "https://gate.app-builder-testing.com";
  } else if (host === "grok.me" || host.endsWith(".grok.me")) {
    issuer = "https://gate.grok.me";
  }
  if (!issuer) return null;

  return { issuer, jwksUrl: `${issuer}${GATE_JWKS_PATH}` };
}

/** セッションに紐づく外部アカウント。providerId と accountId の組。 */
export type GateLinkedAccount = { providerId: string; accountId: string };

/** 今のセッションが、このゲート本人（sub）に紐づいているか。 */
export function sessionBoundToGateIdentity(
  accounts: readonly GateLinkedAccount[],
  identitySub: string,
  gateProviderId: string,
): boolean {
  return accounts.some(
    (account) =>
      account.providerId === gateProviderId &&
      account.accountId === identitySub,
  );
}

/** リクエストヘッダーから本人を取り出す。無効なら null（失敗は閉じる）。 */
export async function gateIdentityFromHeaders(
  headers: Headers,
  jwksFetch?: JwksFetch,
): Promise<GateIdentity | null> {
  if (!gateIdentityEnabled()) return null;
  const token = headers.get(GATE_IDENTITY_HEADER)?.trim();
  if (!token) return null;
  const projectId = env("GROK_PROJECT_ID");
  if (!projectId) return null;
  const endpoints = resolveGateEndpoints(headers);
  if (!endpoints) return null;
  return verifyGateIdentityToken(token, {
    issuer: endpoints.issuer,
    audience: `app:${projectId}`,
    getKey: gateKeyResolver(endpoints.jwksUrl, jwksFetch),
  });
}
