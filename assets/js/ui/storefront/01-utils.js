/* app.js → Utilities
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

export function install(ctx) {
  Object.assign(ctx, { hydrateIcons, toast });
  // Bilingual {ar,fr} objects (products created in the dashboard / loaded from the tables) are resolved to the
  // current language before escaping — otherwise they would render as "[object Object]" (found by e2e 03 in 1.6.0).
  const isBilingual = (v) => v && typeof v === "object" && !Array.isArray(v) && ("ar" in v || "fr" in v);
  const esc = (s) =>
    String((isBilingual(s) ? ctx.R.L(s) : s) ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  const money = (n) => ctx.R.money(n);

  const discountFor = (price, compare) => (compare && compare > price ? Math.round((1 - price / compare) * 100) : 0);

  const variantLabel = (v) => [v.o1, v.o2, v.o3].filter(Boolean).join(" / ");
  const SPEC_LABELS = {
    cpu: "cpu",
    ram: "ram",
    storage: "storage",
    screen: "screen",
    keyboard: "keyboard",
    condition: "condition",
    battery: "battery"
  };
  const specsText = (specs) =>
    Object.entries(specs || {})
      .filter(([key, value]) => value && SPEC_LABELS[key])
      .map(([key, value]) => `${ctx.t(SPEC_LABELS[key])}: ${value}`)
      .join(" · ");

  const svg = (body, filled = false) =>
    `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

  const ICON = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    user: svg('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.6-3.6 3.6-5.5 7.5-5.5s6.9 1.9 7.5 5.5"/>'),
    heart: svg('<path d="M12 20.3S4.8 15.9 4.8 10.9A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.2 2.9c0 5-7.2 9.4-7.2 9.4z"/>'),
    bag: svg('<path d="M6.2 8.2h11.6l1 11.6H5.2l1-11.6z"/><path d="M9 8.2V6.4a3 3 0 0 1 6 0v1.8"/>'),
    chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
    chevronRight: svg('<path d="M9 5.5l6.5 6.5L9 18.5"/>'),
    arrowRight: svg('<path d="M4.5 12h15M13.5 6l6 6-6 6"/>'),
    arrowLeft: svg('<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>'),
    chevronLeft: svg('<path d="M15 5.5L8.5 12 15 18.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    menu: svg('<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>'),
    flame: svg(
      '<path d="M12.4 2.2c.5 3.6-3.2 5.1-3.2 8.8a2.8 2.8 0 0 0 5.6 0c0-1.1-.4-2-1-2.7 2 1.2 3.2 3 3.2 5.2a5.9 5.9 0 1 1-11.8 0c0-4.4 3.6-6.6 6.2-11.3z"/>',
      true
    ),
    trash: svg('<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6"/>'),
    play: svg('<path d="M8 5.5v13l10-6.5z"/>', true),
    star: svg('<path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6L12 16.9l-5.38 2.8 1.03-6L3.3 9.6l6-.9L12 3.2z"/>', true),
    truck: svg(
      '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>'
    ),
    shield: svg('<path d="M12 3l7 2.6v5.6c0 4.4-3 7.6-7 9.8-4-2.2-7-5.4-7-9.8V5.6L12 3z"/><path d="M9 12l2 2 4-4"/>'),
    return: svg('<path d="M4 9h10a5 5 0 0 1 0 10H8"/><path d="M8 5L4 9l4 4"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    smile: svg(
      '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.2"/>'
    ),
    userRound: svg('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.7-3.4 3.4-5 6.5-5s5.8 1.6 6.5 5"/>'),
    badgeCheck: svg(
      '<path d="M12 2.5l2.1 1.6 2.6-.4 1.1 2.4 2.4 1.1-.4 2.6L21.5 12l-1.6 2.1.4 2.6-2.4 1.1-1.1 2.4-2.6-.4L12 21.5l-2.1-1.6-2.6.4-1.1-2.4-2.4-1.1.4-2.6L2.5 12l1.6-2.1-.4-2.6 2.4-1.1 1.1-2.4 2.6.4L12 2.5z"/><path d="M8.3 12.2l2.4 2.4 5-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      true
    ),
    chat: svg(
      '<path d="M4 4h16v11H9.5L4 19.5V4z"/><path d="M8 9.5h8M8 12.5h5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
      true
    ),
    facebook: svg(
      '<path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.5-1.4h1.4V5.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.7v2.1H8v2.8h2.5v7h3z"/>',
      true
    ),
    instagram: svg(
      '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>'
    ),
    tiktok: svg(
      '<path d="M14.5 3h2.6c.2 1.6 1.1 2.9 2.8 3.4v2.6c-1.2 0-2.3-.4-3.2-1v6.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.7a2.8 2.8 0 1 0 2 2.7V3z"/>',
      true
    ),
    apple: svg(
      '<path d="M16.2 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.7-3.1.7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.2-.8-2.2-3.5z"/><path d="M14.1 6.1c.6-.7 1-1.6.9-2.6-.9 0-2 .6-2.6 1.3-.6.6-1 1.6-.9 2.5 1 .1 2-.5 2.6-1.2z"/>',
      true
    ),
    sun: svg(
      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'
    ),
    moon: svg('<path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3z"/>'),
    whatsapp: svg(
      '<path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.3-4.3a8.5 8.5 0 1 1 15.7-4.5z"/><path d="M8.4 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.9c.1.2 0 .4-.1.6l-.6.7c-.2.2-.1.3 0 .5.7 1.2 1.7 2.2 2.9 2.9.2.1.4.2.5 0l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.3.4.5 0 1-.5 1.8-1.4 2.1-.6.2-1.4.3-2.3.1-3.6-.8-6.4-3.6-7.2-7.2-.2-1-.1-1.8.1-2.4z"/>',
      true
    ),
    mapPin: svg('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    leaf: svg(
      '<path d="M20 4c-7.5 0-13 3.2-13 9.2 0 2 .7 3.7 2 4.8C12 14 15 11 19 9c-3 3-5.8 6-7.4 9.6"/><path d="M4 20c2.5-2.3 5.6-3.7 9-4"/>'
    ),
    recycle: svg(
      '<path d="M8.5 4.5h7l2.5 4.3M18 9l1.5 2.6-2.7 1.6M17.2 16H9.8l-2.5-4.3M8.8 15l-2.5-4.2 2.6-1.6M5 13.5l-1.5 2.6 2.7 1.6"/>'
    ),
    bolt: svg('<path d="M13 2L4.5 13H11l-1 9L19.5 11H13z"/>', true),
    creditCard: svg('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 15h4"/>'),
    download: svg('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
    chevronUp: svg('<path d="M6 15l6-6 6 6"/>'),
    logout: svg('<path d="M4 9h10a5 5 0 0 1 0 10H8"/><path d="M8 5L4 9l4 4"/>')
  };

  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      const name = el.dataset.icon;
      if (ICON[name]) el.innerHTML = ICON[name];
    });
  }

  ctx.toastTimer = undefined;
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(ctx.toastTimer);
    ctx.toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  Object.assign(ctx, { esc, money, discountFor, variantLabel, SPEC_LABELS, specsText, svg, ICON });
}
