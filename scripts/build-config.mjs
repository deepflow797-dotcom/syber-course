import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/* Reads Supabase credentials and writes them into assets/js/config.js.

   Precedence: the real environment (Vercel/CI) wins, then `.env` in the project root — because START-HERE.md,
   docs/HANDOVER.md and README all tell the merchant to create `.env` and run `npm run build`. Reading only
   process.env meant a correctly configured `.env` was silently ignored: the store stayed in demo mode and the
   log line claimed "no Supabase environment variables set" (audit finding #7 in 1.8.2). */

/** Minimal .env reader: KEY=value, optional surrounding quotes, `#` comments. Existing env vars win. */
export function readEnvFile(path, env = process.env) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(index + 1).trim();
    if (/^(".+"|'.+')$/.test(value)) value = value.slice(1, -1);
    if (env[key]) continue; // documented precedence: environment first
    out[key] = value;
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isMain) {
  const file = resolve(process.cwd(), "assets/js/config.js");
  const fromFile = readEnvFile(resolve(process.cwd(), ".env"));
  const pick = (key) => process.env[key] || fromFile[key];
  const values = { supabaseUrl: pick("SUPABASE_URL"), supabaseAnonKey: pick("SUPABASE_ANON_KEY") };
  const usedFile = !process.env.SUPABASE_URL && Boolean(fromFile.SUPABASE_URL);

  let source = readFileSync(file, "utf8");
  let changed = false;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    // String.raw keeps `\s` a regex escape instead of a JS escape
    const pattern = new RegExp(String.raw`(${key}:\s*)"[^"]*"`);
    if (!pattern.test(source)) throw new Error(`Could not find ${key} in config.js`);
    source = source.replace(pattern, `$1${JSON.stringify(String(value).trim())}`);
    changed = true;
  }

  if (changed) {
    writeFileSync(file, source);
    console.log(`Restore: injected Supabase configuration${usedFile ? " (from .env)" : ""}.`);
  } else {
    console.log("Restore: no Supabase credentials in the environment or .env; keeping local demo configuration.");
  }
}
