// Restore — owner-only staff provisioning Edge Function.
// Deploy with: supabase functions deploy admin-create-staff --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Security:
// - The caller's JWT is verified with the REST Auth API.
// - Only a restore_staff row with role = "owner" can create accounts.
// - The service_role key never reaches the browser.
// - Input is validated and truncated before it reaches Postgres.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff"
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });

const clean = (value, max = 120) => String(value ?? "").trim().slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "server_not_configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "missing_token" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 0. Rate limit (shared across instances via restore_rate_hit; fail-closed if the RPC is missing).
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const { data: allowed, error: rateError } = await admin.rpc("restore_rate_hit", { p_key: `staff:${ip}`, p_limit: 10, p_window_seconds: 600 });
    if (rateError) { console.error("admin-create-staff: rate limit unavailable", rateError); return json({ error: "rate_limit_unavailable" }, 503); }
    if (allowed === false) return json({ error: "too_many_requests" }, 429);

    // 1. Verify the caller.
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "invalid_token" }, 401);

    // 2. Verify the caller is an owner in restore_staff.
    const { data: staff, error: staffError } = await admin
      .from("restore_staff")
      .select("role, active")
      .eq("auth_id", userData.user.id)
      .maybeSingle();
    if (staffError) throw staffError;
    if (!staff || staff.role !== "owner" || staff.active === false) {
      return json({ error: "owner_only" }, 403);
    }

    // 3. Validate input.
    const body = await req.json().catch(() => ({}));
    const email = clean(body.email, 254).toLowerCase();
    const password = String(body.password ?? "");
    const name = {
      ar: clean(body.name?.ar || body.nameAr || "", 80),
      fr: clean(body.name?.fr || body.nameFr || "", 80)
    };
    const role = body.role === "owner" ? "owner" : "manager";
    const whatsapp = clean(body.whatsapp, 20).replace(/\D/g, "");

    if (!isEmail(email)) return json({ error: "invalid_email" }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: "invalid_password" }, 400);
    if (!name.ar && !name.fr) return json({ error: "invalid_name" }, 400);
    if (whatsapp && whatsapp.length !== 8 && whatsapp.length !== 11) {
      return json({ error: "invalid_whatsapp" }, 400);
    }

    // 4. Create the Auth user (email pre-confirmed so the manager can log in immediately).
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { must_change_password: true, display_name: name.ar || name.fr }
    });
    if (createError) {
      const message = String(createError.message || "");
      if (/already|exists|registered/i.test(message)) return json({ error: "email_exists" }, 409);
      throw createError;
    }

    // 5. Insert the staff profile row.
    const { data: row, error: rowError } = await admin
      .from("restore_staff")
      .insert({
        auth_id: created.user.id,
        username: email,
        email,
        name: name.ar || name.fr ? { ar: name.ar || name.fr, fr: name.fr || name.ar } : { ar: email, fr: email },
        role,
        whatsapp,
        must_change_password: true
      })
      .select("id, auth_id, username, email, name, role, whatsapp, must_change_password, created_at")
      .single();

    if (rowError) {
      // Roll back the Auth user so a partial failure cannot leave an orphan login.
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw rowError;
    }

    return json({ success: true, staff: row }, 201);
  } catch (error) {
    console.error("admin-create-staff:", error);
    return json({ error: "create_failed", message: clean(error?.message || error, 200) }, 400);
  }
});
