/** Supabase session mode (5432) caps clients at the pool size. Serverless needs transaction mode (6543). */
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
