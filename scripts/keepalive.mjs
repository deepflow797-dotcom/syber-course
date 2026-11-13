#!/usr/bin/env node
/* Keep a free Supabase project from pausing (7 idle days): one tiny authenticated-as-anon read.
   No secrets needed — URL and publishable key are read from assets/js/config.js (public by design). */
import fs from "node:fs";
import { readSupabaseConfig } from "./lib/client-sync.mjs";

const { url, anonKey } = readSupabaseConfig(fs.readFileSync("assets/js/config.js", "utf8"));
if (!url || !anonKey) {
  console.log("keepalive: config.js has no Supabase URL/key yet — nothing to ping");
  process.exit(0);
}
const res = await fetch(`${url}/rest/v1/restore_state?select=id&limit=1`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
});
if (!res.ok) {
  console.error(`keepalive: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`keepalive: awake (${url})`);
