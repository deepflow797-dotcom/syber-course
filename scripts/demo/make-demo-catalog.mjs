#!/usr/bin/env node
/* Generates a neutral, rights-free demo catalog: assets/js/data.js + SVG product/category/hero art.
   No real brand photos, no third-party CDN links. Merchants replace it from the dashboard. */
import fs from "node:fs";
fs.mkdirSync("assets/products", { recursive: true });
const pal = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0891b2", "#4f46e5", "#b45309"];
const icons = {
  Smartphone:
    '<rect x="70" y="30" width="60" height="140" rx="12" fill="#fff" opacity=".92"/><rect x="78" y="44" width="44" height="100" rx="4" fill="url(#g)"/><circle cx="100" cy="158" r="5" fill="#cbd5e1"/>',
  Laptop:
    '<rect x="35" y="55" width="130" height="80" rx="8" fill="#fff" opacity=".92"/><rect x="43" y="63" width="114" height="64" rx="3" fill="url(#g)"/><rect x="20" y="138" width="160" height="10" rx="4" fill="#e2e8f0"/>',
  Tablets:
    '<rect x="50" y="35" width="100" height="130" rx="12" fill="#fff" opacity=".92"/><rect x="58" y="47" width="84" height="106" rx="4" fill="url(#g)"/>',
  Watch:
    '<rect x="80" y="20" width="40" height="40" rx="8" fill="#e2e8f0"/><rect x="80" y="140" width="40" height="40" rx="8" fill="#e2e8f0"/><rect x="60" y="55" width="80" height="90" rx="20" fill="#fff" opacity=".92"/><rect x="70" y="65" width="60" height="70" rx="12" fill="url(#g)"/>',
  Audio:
    '<path d="M55 120 v-25 a45 45 0 0 1 90 0 v25" stroke="#fff" stroke-width="10" fill="none"/><rect x="40" y="110" width="30" height="45" rx="10" fill="#fff" opacity=".95"/><rect x="130" y="110" width="30" height="45" rx="10" fill="#fff" opacity=".95"/>',
  Accessories:
    '<rect x="60" y="40" width="80" height="120" rx="14" fill="#fff" opacity=".92"/><circle cx="100" cy="100" r="22" fill="url(#g)"/>',
  Gaming:
    '<rect x="35" y="70" width="130" height="60" rx="30" fill="#fff" opacity=".92"/><circle cx="70" cy="100" r="9" fill="url(#g)"/><circle cx="130" cy="92" r="6" fill="#f43f5e"/><circle cx="142" cy="104" r="6" fill="#22c55e"/>',
  Charger:
    '<rect x="80" y="30" width="40" height="40" rx="8" fill="#fff" opacity=".92"/><path d="M100 70 v90" stroke="#fff" stroke-width="8"/><rect x="88" y="150" width="24" height="24" rx="4" fill="#fff"/>'
};
const svg = (type, color, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="200" height="200" rx="24" fill="${color}" opacity=".16"/>${icons[type] || icons.Accessories}<text x="100" y="192" font-family="Arial,Helvetica,sans-serif" font-size="11" text-anchor="middle" fill="#334155">${label}</text></svg>`;
const mk = (handle, title, type, vendor, price, compare, collections, opts, colors = [], body = "") => ({
  handle,
  title,
  vendor,
  type,
  price,
  compare,
  discount: compare ? Math.round((1 - price / compare) * 100) : 0,
  image: `assets/products/${handle}.svg`,
  images: [`assets/products/${handle}.svg`],
  colors,
  options: opts,
  variants: [],
  collections,
  available: true,
  body
});
const P = [
  mk(
    "smartphone-pro-128",
    "Smartphone Pro 128 GB",
    "Smartphone",
    "Demo Mobile",
    12900,
    18900,
    ["phones", "special-offers"],
    [
      { name: "Storage", values: ["128 GB", "256 GB"] },
      { name: "Condition", values: ["New", "Excellent"] }
    ],
    [
      { name: "Black", hex: "#111827" },
      { name: "Blue", hex: "#2563eb" }
    ],
    "<p>Demo product. Replace this description from the dashboard.</p>"
  ),
  mk(
    "smartphone-lite-64",
    "Smartphone Lite 64 GB",
    "Smartphone",
    "Demo Mobile",
    6900,
    8900,
    ["phones", "special-offers"],
    [{ name: "Storage", values: ["64 GB", "128 GB"] }],
    [{ name: "Silver", hex: "#cbd5e1" }]
  ),
  mk(
    "smartphone-max-256",
    "Smartphone Max 256 GB",
    "Smartphone",
    "Demo Mobile",
    17900,
    null,
    ["phones"],
    [{ name: "Storage", values: ["256 GB", "512 GB"] }],
    [{ name: "Green", hex: "#059669" }]
  ),
  mk(
    "smartphone-mini-128",
    "Smartphone Mini 128 GB",
    "Smartphone",
    "Demo Mobile",
    8900,
    11900,
    ["phones", "special-offers"],
    [{ name: "Storage", values: ["128 GB"] }],
    [{ name: "Pink", hex: "#db2777" }]
  ),
  mk(
    "android-flagship-256",
    "Android Flagship 256 GB",
    "Smartphone",
    "Demo Android",
    14900,
    19900,
    ["android", "special-offers"],
    [{ name: "Storage", values: ["256 GB"] }],
    [{ name: "Graphite", hex: "#374151" }]
  ),
  mk(
    "android-fold",
    "Android Fold",
    "Smartphone",
    "Demo Android",
    24900,
    null,
    ["android"],
    [{ name: "Storage", values: ["256 GB", "512 GB"] }]
  ),
  mk(
    "android-note",
    "Android Note",
    "Smartphone",
    "Demo Android",
    9900,
    12900,
    ["android"],
    [{ name: "Storage", values: ["128 GB"] }]
  ),
  mk(
    "android-budget",
    "Android Budget",
    "Smartphone",
    "Demo Android",
    3900,
    4900,
    ["android", "special-offers"],
    [{ name: "Storage", values: ["64 GB"] }]
  ),
  mk(
    "laptop-business-14",
    'Business Laptop 14"',
    "Laptop",
    "Demo Computers",
    15900,
    21900,
    ["laptops", "special-offers"],
    [
      { name: "RAM", values: ["8 GB", "16 GB"] },
      { name: "SSD", values: ["256 GB", "512 GB"] }
    ]
  ),
  mk(
    "laptop-ultrabook-13",
    'Ultrabook 13"',
    "Laptop",
    "Demo Computers",
    19900,
    null,
    ["laptops"],
    [{ name: "RAM", values: ["16 GB"] }]
  ),
  mk(
    "laptop-student-15",
    'Student Laptop 15"',
    "Laptop",
    "Demo Computers",
    9900,
    12900,
    ["laptops"],
    [{ name: "RAM", values: ["8 GB"] }]
  ),
  mk(
    "laptop-creator-16",
    'Creator Laptop 16"',
    "Macbook",
    "Demo Computers",
    32900,
    39900,
    ["laptops", "macbooks"],
    [{ name: "RAM", values: ["16 GB", "32 GB"] }]
  ),
  mk(
    "tablet-10",
    'Tablet 10"',
    "Tablets",
    "Demo Tablets",
    7900,
    9900,
    ["tablets"],
    [{ name: "Storage", values: ["64 GB", "256 GB"] }]
  ),
  mk(
    "smartwatch-s",
    "Smartwatch S",
    "Watch",
    "Demo Wear",
    4900,
    6900,
    ["watches"],
    [{ name: "Size", values: ["41 mm", "45 mm"] }]
  ),
  mk(
    "wireless-earbuds",
    "Wireless Earbuds",
    "Audio",
    "Demo Audio",
    1900,
    2900,
    ["audio", "special-offers"],
    [{ name: "Color", values: ["White", "Black"] }]
  ),
  mk(
    "headphones-anc",
    "ANC Headphones",
    "Audio",
    "Demo Audio",
    3900,
    null,
    ["audio"],
    [{ name: "Color", values: ["Black"] }]
  ),
  mk(
    "fast-charger-65w",
    "Fast Charger 65 W",
    "Charger",
    "Demo Power",
    900,
    1200,
    ["chargers"],
    [{ name: "Plug", values: ["EU"] }]
  ),
  mk(
    "power-bank-20000",
    "Power Bank 20 000 mAh",
    "Charger",
    "Demo Power",
    1500,
    null,
    ["chargers"],
    [{ name: "Color", values: ["Black"] }]
  ),
  mk(
    "game-controller",
    "Game Controller",
    "Gaming",
    "Demo Play",
    2400,
    2900,
    ["gaming"],
    [{ name: "Color", values: ["Black", "White"] }]
  ),
  mk(
    "clear-case",
    "Clear Case",
    "Accessories",
    "Demo Access",
    300,
    null,
    ["accessories"],
    [{ name: "Model", values: ["Pro", "Lite", "Max"] }]
  ),
  mk(
    "screen-protector",
    "Tempered Glass",
    "Accessories",
    "Demo Access",
    250,
    400,
    ["accessories", "special-offers"],
    [{ name: "Model", values: ["Pro", "Lite"] }]
  )
];
let vid = 1000;
P.forEach((p, i) => {
  const color = pal[i % pal.length];
  fs.writeFileSync(p.image, svg(p.type, color, p.title.replace(/"/g, "")));
  const [o1, o2] = p.options;
  for (const a of o1.values)
    for (const b of o2?.values || [null]) {
      const bump = (o1.values.indexOf(a) + (o2 ? o2.values.indexOf(b) : 0)) * Math.round(p.price * 0.12);
      p.variants.push({
        id: ++vid,
        title: [a, b].filter(Boolean).join(" / "),
        o1: a,
        o2: b,
        o3: null,
        price: p.price + bump,
        compare: p.compare ? p.compare + bump : null,
        available: true,
        image: null
      });
    }
});
const collections = [
  ["special-offers", "Special Offers"],
  ["phones", "Smartphones"],
  ["android", "Android"],
  ["laptops", "Laptops"],
  ["macbooks", "Creator Laptops"],
  ["tablets", "Tablets"],
  ["watches", "Smartwatches"],
  ["audio", "Audio"],
  ["chargers", "Chargers & Power"],
  ["gaming", "Gaming"],
  ["accessories", "Cases & Protection"]
].map(([handle, title]) => ({ handle, title }));
const by = (c) =>
  P.filter((p) => p.collections.includes(c))
    .map((p) => p.handle)
    .slice(0, 8);
const data = {
  brand: "Demo Store",
  currency: "MRU",
  products: P,
  home: { anniversary: by("special-offers"), iphones: by("phones"), samsung: by("android"), laptops: by("laptops") },
  collections,
  theme: {
    hero: [
      {
        image: "assets/img/hero-1.svg",
        mobile: "assets/img/hero-1.svg",
        href: "collection.html?handle=special-offers",
        alt: "Special offers"
      },
      {
        image: "assets/img/hero-2.svg",
        mobile: "assets/img/hero-2.svg",
        href: "collection.html?handle=all",
        alt: "All products"
      }
    ],
    categories: collections.map((c) => ({
      label: c.title,
      handle: c.handle,
      image: `assets/img/category-${c.handle}.svg`
    }))
  }
};
collections.forEach((c, i) =>
  fs.writeFileSync(
    `assets/img/category-${c.handle}.svg`,
    svg(P.find((p) => p.collections.includes(c.handle))?.type || "Accessories", pal[i % pal.length], c.title)
  )
);
const hero = (a, b, text) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 640"><defs><linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1600" height="640" fill="url(#h)"/><circle cx="1300" cy="320" r="220" fill="#fff" opacity=".08"/><circle cx="1380" cy="200" r="120" fill="#fff" opacity=".08"/><text x="110" y="330" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700" fill="#fff">${text}</text><text x="110" y="400" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="#fff" opacity=".85">Demo banner — replace from the dashboard</text></svg>`;
fs.writeFileSync("assets/img/hero-1.svg", hero("#1d4ed8", "#7c3aed", "Special offers up to -40%"));
fs.writeFileSync("assets/img/hero-2.svg", hero("#0f766e", "#0891b2", "Quality products, fast delivery"));
fs.writeFileSync("assets/js/data.js", "window.STORE = " + JSON.stringify(data) + ";\n");
console.log(
  `demo catalog: ${P.length} products, ${P.reduce((n, p) => n + p.variants.length, 0)} variants, ${collections.length} collections`
);

// Decorative home-page art (promo tiles, customer-story tiles, service image) — neutral gradients, no photos.
fs.mkdirSync("assets/img/restore", { recursive: true });
const tile = (a, b, text, w = 800, h = 600) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#t)"/><circle cx="${w * 0.8}" cy="${h * 0.3}" r="${h * 0.35}" fill="#fff" opacity=".10"/><text x="48" y="${h - 48}" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(h / 12)}" font-weight="700" fill="#fff">${text}</text></svg>`;
[
  ["promo-iphone", "#1e3a8a", "#2563eb", "Smartphones"],
  ["promo-samsung", "#312e81", "#7c3aed", "Android"],
  ["promo-laptops", "#064e3b", "#059669", "Laptops"]
].forEach(([n, a, b, t]) => fs.writeFileSync(`assets/img/restore/${n}.svg`, tile(a, b, t)));
["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0891b2"].forEach((c, i) =>
  fs.writeFileSync(`assets/img/restore/video-${i + 1}.svg`, tile(c, "#0f172a", `Customer story ${i + 1}`, 540, 960))
);
fs.writeFileSync("assets/img/service-phones.svg", tile("#0f172a", "#334155", "Checked one by one", 900, 700));
try {
  fs.unlinkSync("assets/img/service-phones.webp");
} catch {}
console.log("decorative art regenerated");
