// @ts-check
/* state.js → Manager record helpers (pure: display names, WhatsApp normalisation, staff row mapping).
   Used by 04-staff-auth.js; no DOM, no storage, no network. */

/** Lower-cased WhatsApp digits, validated against the Mauritanian lengths (8 or 11). */
export function normalizeWhatsapp(ctx, value) {
  const whatsapp = ctx.normalizeDigits(value || "");
  if (whatsapp && ![8, 11].includes(whatsapp.length)) throw new Error("رقم واتساب غير صالح");
  return whatsapp;
}

/** Display name of a new manager, in both languages, falling back to the identifier. */
export function managerName(data) {
  const fallback = String(data.email || data.username || "").trim();
  return {
    ar: String(data.nameAr || data.name || "").trim() || fallback,
    fr: String(data.nameFr || data.name || "").trim() || fallback
  };
}

/** Staff-table row → manager record (the shape stored in `ctx.managers`). */
export function staffRowToManager(ctx, row) {
  if (!row) return null;
  const email = row.email || "";
  return {
    id: row.id,
    authId: row.auth_id || "",
    username: email,
    email,
    name: row.name || ctx.txt(email, email),
    role: row.role === "owner" ? "owner" : "manager",
    whatsapp: row.whatsapp || "",
    avatar: row.avatar || "",
    active: row.active !== false,
    mustChange: Boolean(row.must_change_password),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}
