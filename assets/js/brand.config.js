/* ============================================================================
   BRAND CONFIG — the ONLY place a merchant's identity lives.
   `npm run new-client` fills this file; the dashboard can override everything later (saved in the database).
   Plain script (not a module) so it is available before state.js runs.
   ============================================================================ */
window.BRAND = {
  key: "demo", // short slug: folder / subdomain / repo name
  name: { ar: "متجر تجريبي", fr: "Demo Store" }, // store name shown everywhere
  legalName: { ar: "متجر تجريبي ش.ذ.م.م", fr: "Demo Store SARL" },
  tagline: { ar: "منتجات أصلية وتوصيل سريع", fr: "Produits authentiques, livraison rapide" },
  logo: "assets/img/brand-logo.svg",
  logoWhite: "assets/img/brand-logo-white.svg",
  favicon: "assets/img/favicon.svg",
  colors: { primary: "#2563eb", ink: "#0f172a", purple: "#7c3aed", lavender: "#eef2ff" },
  font: "Montserrat",
  country: {
    code: "MR",
    name: { ar: "موريتانيا", fr: "Mauritanie" },
    dial: "+222",
    currencyCode: "MRU",
    currency: { ar: "أوقية", fr: "MRU" },
    currencyName: { ar: "أوقية جديدة", fr: "Nouvelle ouguiya" },
    flag: "assets/img/flag-mr.svg"
  },
  city: { ar: "نواكشوط", fr: "Nouakchott" },
  address: { ar: "نواكشوط، موريتانيا", fr: "Nouakchott, Mauritanie" },
  timezone: "Africa/Nouakchott",
  phone: "+22200000000",
  phoneDisplay: "+222 00 00 00 00",
  whatsapp: "22200000000",
  email: "contact@example.com",
  staffEmailDomain: "example.com", // username login "ali" → ali@staffEmailDomain (must match the Auth user e-mail)
  domain: "", // e.g. "demo.pages.dev" — used for canonical URLs / sitemap
  social: { facebook: "", instagram: "", tiktok: "", snapchat: "", youtube: "", x: "" },
  couponPrefix: "WELCOME" // demo coupon code = WELCOME10
};
