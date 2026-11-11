/* Restore storefront configuration.
   Production: set supabaseUrl + supabaseAnonKey (public key only) and deploy
   the Edge Functions in supabase/functions/. Never put a service_role key here.
   Local demo (development only): set demoEnabled:true and run on localhost.
   On Vercel, SUPABASE_URL/SUPABASE_ANON_KEY can be injected by
   `node scripts/build-config.mjs` — see README.md. */
window.RESTORE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  mode: "auto", // "auto" | "local" | "supabase"
  demoEnabled: false, // local/dev demo accounts only; keep false in production
  requireServerOrders: true, // when true + remote: reject orders unless the Edge Function validates them
  createOrderFunction: "create-order",
  createStaffFunction: "admin-create-staff",
  staffTable: "restore_staff",
  stateTable: "restore_state",
  ordersTable: "restore_orders",
  abandonedTable: "restore_abandoned",
  auditTable: "restore_audit",
  mediaBucket: "restore-media",
  pollMs: 5000
};
