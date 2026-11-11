import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RateState = { count: number; resetAt: number };
const rateMap = new Map<string, RateState>();
const WINDOW_MS = 60_000;
const MAX_REQ = 12;

function env(name: string) { return String(Deno.env.get(name) || "").trim(); }
function allowedOrigins() {
  return env("ALLOWED_ORIGIN") || env("SITE_URL")
    ? (env("ALLOWED_ORIGIN") || env("SITE_URL")).split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean)
    : [];
}
function isProduction() {
  return env("ENV") === "production" || allowedOrigins().length > 0;
}
function isLocalOrigin(origin: string | null) {
  return !!origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
}
function corsHeaders(origin: string | null) {
  const allow = allowedOrigins();
  const ok = !origin || allow.includes(origin.replace(/\/$/, "")) || (!isProduction() && isLocalOrigin(origin));
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : (allow[0] || "*"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  } as Record<string, string>;
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
}
function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}
function localRateLimit(key: string) {
  const now = Date.now();
  const cur = rateMap.get(key);
  if (!cur || cur.resetAt <= now) { rateMap.set(key, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (cur.count >= MAX_REQ) return false;
  cur.count += 1;
  return true;
}
async function verifyTurnstile(token: string | undefined, ip: string, origin: string | null) {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret) {
    // Turnstile is opt-in. Only fail closed when the operator explicitly demands it.
    if (env("TURNSTILE_REQUIRED") === "true") {
      console.warn("create-order: TURNSTILE_REQUIRED=true but TURNSTILE_SECRET_KEY missing; rejecting request");
      return { ok: false, status: 503, error: "CAPTCHA not configured" };
    }
    return { ok: true };
  }
  if (!token) return { ok: false, status: 403, error: "Security check failed" };
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.success ? { ok: true } : { ok: false, status: 403, error: "Security check failed" };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, origin);

  const ip = clientIp(req);
  if (!localRateLimit(`${ip}:${origin || ""}`)) return json({ ok: false, error: "Too many requests. Please try again shortly." }, 429, origin);

  try {
    const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });

    // Shared rate limit (primary) — best-effort fallback to local map above.
    try {
      const { data: allowed } = await supabase.rpc("restore_rate_hit", { p_key: `order:${ip}`, p_limit: MAX_REQ, p_window_seconds: 60 });
      if (allowed === false) return json({ ok: false, error: "Too many requests. Please try again shortly." }, 429, origin);
    } catch (e) {
      console.warn("create-order: shared rate limit unavailable", e);
    }

    const body = await req.json().catch(() => ({}));
    const turnstile = await verifyTurnstile(body?.turnstileToken, ip, origin);
    if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, turnstile.status || 403, origin);

    const draft = body?.order && typeof body.order === "object" ? body.order : body;
    const itemsIn = Array.isArray(draft?.items) ? draft.items : [];
    if (!itemsIn.length || itemsIn.length > 50) return json({ ok: false, error: "Order items are required" }, 400, origin);
    const name = String(draft?.customer?.name || "").trim();
    const phone = String(draft?.customer?.phone || "").replace(/\D/g, "");
    if (!name || phone.length < 8) return json({ ok: false, error: "Customer details are required" }, 400, origin);

    // Relational RPC (0002) — run migrate-state-to-tables.mjs and apply migration 0002 first.
    const { data, error } = await supabase.rpc("restore_create_order_v2", { p_order: draft });
    if (error && /function .*restore_create_order_v2.* does not exist/i.test(String(error.message || error))) {
      return json({ ok: false, error: "Order service not migrated (restore_create_order_v2 missing). Apply migration 0002." }, 503, origin);
    }
    if (error) return json({ ok: false, error: String(error.message || error) }, 400, origin);

    return json({ ok: true, order: data }, 200, origin);
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e) }, 400, origin);
  }
});
