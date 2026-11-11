// @ts-check
/**
 * Minimal PostgREST/Auth fetch wrapper (no SDK). Public anon key only — never a service_role key.
 * @param {{ supabaseUrl?: string, supabaseAnonKey?: string }} config
 */
export function createClient(config) {
  const base = String(config?.supabaseUrl || "").replace(/\/$/, "");
  const key = String(config?.supabaseAnonKey || "");
  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, token?: string | null, headers?: Record<string, string> }} [opts]
   */
  async function request(path, { method = "GET", body, token, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }
  return { request, base, key };
}
