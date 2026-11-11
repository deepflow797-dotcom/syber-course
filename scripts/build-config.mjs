import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), "assets/js/config.js");
const values = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY
};

let source = readFileSync(file, "utf8");
let changed = false;
for (const [key, value] of Object.entries(values)) {
  if (value === undefined || value === "") continue;
  const pattern = new RegExp(`(${key}:\\s*)"[^"]*"`);
  if (!pattern.test(source)) throw new Error(`Could not find ${key} in config.js`);
  source = source.replace(pattern, `$1${JSON.stringify(String(value).trim())}`);
  changed = true;
}

if (changed) {
  writeFileSync(file, source);
  console.log("Restore: injected Supabase configuration.");
} else {
  console.log("Restore: no Supabase environment variables set; keeping local demo configuration.");
}
