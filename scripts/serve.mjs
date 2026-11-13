#!/usr/bin/env node
/* Local static server that behaves like Cloudflare Pages / Netlify: it serves the current directory AND applies the
   rules from `_headers` (first-match-per-rule, all matching blocks merged, later blocks override earlier ones), so the
   real Content-Security-Policy is enforced locally — exactly what e2e and Lighthouse run against. Text assets are
   gzip/brotli-compressed on the fly like every production CDN does, so Lighthouse measures realistic transfer sizes.
   Usage: node scripts/serve.mjs [--port 8100] [--host 127.0.0.1] [--root .] [--quiet]
   Programmatic: import { startServer } from "./serve.mjs"; const srv = await startServer({ port: 0 }); srv.close(). */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

/** Parse a Netlify/Cloudflare `_headers` file into [{ pattern, headers }]. */
export function parseHeadersFile(text) {
  const rules = [];
  let current = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: {} };
      rules.push(current);
    } else if (current) {
      const idx = line.indexOf(":");
      if (idx > 0) current.headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return rules;
}

/** `_headers` glob → RegExp: `*` matches any run of characters, `:name` matches one path segment. */
export function patternToRegExp(pattern) {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:\w+/g, "[^/]+"))
    .join(".*");
  return new RegExp(`^${source}$`);
}

/** Headers to send for `urlPath` according to the rules (all matching blocks apply; later ones win). */
export function headersFor(rules, urlPath) {
  const out = {};
  for (const rule of rules) if (patternToRegExp(rule.pattern).test(urlPath)) Object.assign(out, rule.headers);
  return out;
}

const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json|javascript)|image\/svg\+xml)/;
/** @param {string|string[]|undefined} accept @param {string} type */
function pickEncoding(accept, type) {
  const list = String(accept || "");
  if (!COMPRESSIBLE.test(type)) return "";
  if (/\bbr\b/.test(list)) return "br";
  if (/\bgzip\b/.test(list)) return "gzip";
  return "";
}

export function startServer({ port = 8100, host = "127.0.0.1", root = process.cwd(), quiet = true } = {}) {
  const headersPath = path.join(root, "_headers");
  const rules = fs.existsSync(headersPath) ? parseHeadersFile(fs.readFileSync(headersPath, "utf8")) : [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(root, pathname));
    if (!file.startsWith(path.normalize(root)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const extra = headersFor(rules, pathname);
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const encoding = pickEncoding(req.headers["accept-encoding"], type);
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      ...(encoding ? { "Content-Encoding": encoding, Vary: "Accept-Encoding" } : {}),
      ...extra
    });
    if (!quiet) console.log(`${req.method} ${pathname}`);
    const stream = fs.createReadStream(file);
    if (encoding === "br") stream.pipe(zlib.createBrotliCompress()).pipe(res);
    else if (encoding === "gzip") stream.pipe(zlib.createGzip()).pipe(res);
    else stream.pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = /** @type {import("node:net").AddressInfo} */ (server.address());
      resolve({
        port: address.port,
        url: `http://${host}:${address.port}`,
        rules,
        close: () => new Promise((done) => server.close(() => done(undefined)))
      });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
  };
  const srv = await startServer({
    port: Number(arg("port", 8100)),
    host: arg("host", "127.0.0.1"),
    root: path.resolve(arg("root", ".")),
    quiet: process.argv.includes("--quiet")
  });
  console.log(`serving ${process.cwd()} at ${srv.url} (${srv.rules.length} _headers rules applied)`);
}
