/**
 * Supabase の接続文字列を、サーバーレス向けのポートに直す。
 * プーラーの 5432（セッションモード）は 6543（トランザクションモード）にする。
 * それ以外の URL はそのまま。待ち時間の上限は lib/db.ts のプール設定。
 */
/** Supabase session mode (5432) caps clients at the pool size. Serverless needs transaction mode (6543). */
/** 5432 の Supabase プーラーだけ 6543 に差し替える。壊れた URL はそのまま返す。 */
export function serverlessDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith("pooler.supabase.com") && (url.port === "5432" || url.port === "")) {
      url.port = "6543";
    }
    return url.toString();
  } catch {
    return raw;
  }
}
