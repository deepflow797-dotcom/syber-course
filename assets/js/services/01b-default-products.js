// @ts-check
/* state.js → Demo product builders (descriptions, specs, variants, price rounding).
   Pure functions over `ctx.RAW.products`; called by the default-state builders in 01a-default-state.js. */

/**
 * @param {Record<string, any>} ctx shared state context
 */
export function createProductBuilders(ctx) {
  const B = window.BRAND || {};
  const BN = { ar: B.name?.ar || "متجر", fr: B.name?.fr || "Store" };
  const bt = (ar, fr) => ctx.txt(ar.split("{brand}").join(BN.ar), fr.split("{brand}").join(BN.fr));
  const { TYPE_DESCRIPTIONS } = ctx;

  function productDescriptions(type) {
    return (
      TYPE_DESCRIPTIONS[type] ||
      bt(
        "جهاز مجدد تم فحصه واختباره من طرف خبراء {brand}، ويأتي بضمان 12 شهرًا.",
        "Appareil reconditionné, inspecté et testé par les experts {brand}, avec 12 mois de garantie."
      )
    );
  }

  function hashHandle(handle) {
    let h = 0;
    for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
    return h;
  }

  function includesFor(p) {
    const map = {
      Macbook: [
        ctx.txt("جهاز MacBook", "MacBook"),
        ctx.txt("شاحن أصلي", "Chargeur d’origine"),
        ctx.txt("كابل USB-C", "Câble USB-C")
      ],
      Laptop: [
        ctx.txt("الحاسوب المحمول", "Ordinateur portable"),
        ctx.txt("الشاحن", "Chargeur"),
        ctx.txt("كابل الطاقة", "Câble d’alimentation")
      ],
      Smartphone: [
        ctx.txt("الهاتف", "Téléphone"),
        ctx.txt("كابل الشحن", "Câble de charge"),
        ctx.txt("أداة إخراج الشريحة", "Outil SIM")
      ],
      Tablets: [
        ctx.txt("الجهاز اللوحي", "Tablette"),
        ctx.txt("كابل الشحن", "Câble de charge"),
        ctx.txt("الشاحن", "Chargeur")
      ],
      "Apple Watch": [
        ctx.txt("الساعة", "Montre"),
        ctx.txt("السوار", "Bracelet"),
        ctx.txt("شاحن مغناطيسي", "Chargeur magnétique")
      ],
      Playstation: [
        ctx.txt("الجهاز", "Console"),
        ctx.txt("يد التحكم", "Manette"),
        ctx.txt("كابلات التوصيل", "Câbles de connexion")
      ],
      Accessories: [ctx.txt("الملحق", "Accessoire"), ctx.txt("دليل الاستخدام", "Guide d’utilisation")]
    };
    return map[p.type] || [ctx.txt("الجهاز", "Appareil"), ctx.txt("الكابل", "Câble")];
  }

  const isLaptopType = (type) => type === "Laptop" || type === "Macbook";

  function cpuFromTitle(title) {
    const match = title.match(/(Core i[3579][^,/(-]*|M[1234](?: Pro| Max)?|Ryzen [3579][^,/(-]*)/i);
    return match?.[0];
  }

  function defaultCpu(p) {
    if (p.type === "Macbook") return "Apple Silicon";
    if (isLaptopType(p.type)) return "Intel Core i5";
    if (p.type === "Smartphone") return "SoC";
    return "—";
  }

  function defaultRam(p) {
    if (isLaptopType(p.type)) return "8 GB";
    return p.type === "Smartphone" ? "6 GB" : "—";
  }

  function defaultStorage(p) {
    if (p.type === "Smartphone") return "128 GB";
    return isLaptopType(p.type) ? "256 GB SSD" : "—";
  }

  const SCREEN_BY_TYPE = {
    Macbook: '13.3"',
    Laptop: '14"',
    Smartphone: '6.1"',
    Tablets: '10.2"',
    "Apple Watch": "45 mm"
  };

  const CPU_CHOICES = ["Intel Core i7", "Intel Core i5", "Apple M1", "Apple M2"];
  const RAM_CHOICES = ["8 GB", "16 GB", "32 GB"];
  const SCREEN_CHOICES = { laptop: ['13.3"', '14"', '15.6"', '16"'], phone: ['5.8"', '6.1"', '6.7"'] };

  function screenChoices(p, screen) {
    if (isLaptopType(p.type)) return [screen, ...SCREEN_CHOICES.laptop];
    if (p.type === "Smartphone") return SCREEN_CHOICES.phone;
    return [];
  }

  function optionValue(p, pattern) {
    return p.options?.find((option) => pattern.test(option.name))?.values?.[0];
  }

  function laptopChoices(laptop, current, options) {
    return laptop ? [current, ...options] : [];
  }

  function specsFor(p, battery) {
    const laptop = isLaptopType(p.type);
    const cpu = optionValue(p, /cpu/i) || cpuFromTitle(p.title || "") || defaultCpu(p);
    const ram = optionValue(p, /ram/i) || defaultRam(p);
    const storage = optionValue(p, /storage/i) || defaultStorage(p);
    const screen = SCREEN_BY_TYPE[p.type] || "—";
    const condition = optionValue(p, /condition|état/i) || "Excellent";
    return {
      cpu: { label: ctx.txt("المعالج", "Processeur"), value: cpu, choices: laptopChoices(laptop, cpu, CPU_CHOICES) },
      ram: { label: ctx.txt("الذاكرة", "Mémoire RAM"), value: ram, choices: laptopChoices(laptop, ram, RAM_CHOICES) },
      storage: { label: ctx.txt("التخزين", "Stockage"), value: storage, choices: [] },
      screen: {
        label: ctx.txt("حجم الشاشة", "Taille d’écran"),
        value: screen,
        choices: screenChoices(p, screen)
      },
      keyboard: {
        label: ctx.txt("لوحة المفاتيح", "Clavier"),
        value: laptop ? ctx.txt("فرنسي AZERTY", "Français AZERTY") : null,
        choices: laptop ? ["Français AZERTY", "QWERTY (US)", "Arabe / Anglais"] : []
      },
      condition: { label: ctx.txt("الحالة", "État"), value: condition, choices: [] },
      battery: { label: ctx.txt("صحة البطارية", "Santé de la batterie"), value: `${battery}%`, choices: [] }
    };
  }
  function priceProduct(p) {
    const price = ctx.roundMRU(p.price);
    const compare = ctx.roundMRU(p.compare);
    return {
      ...p,
      price,
      compare: compare > price ? compare : 0,
      discount: compare > price ? Math.round((1 - price / compare) * 100) : 0
    };
  }

  const colorImageMap = (p) => {
    const map = {};
    (p.colors || []).forEach((color, index) => {
      const images = p.images || [];
      map[color.name] = images.length ? images[Math.min(index, images.length - 1)] : p.image;
    });
    return map;
  };

  const remoteColorMap = (raw) => {
    const map = {};
    for (const variant of raw.variants || []) {
      const alt = variant.image?.alt;
      if (alt && variant.image?.src) map[alt] = variant.image.src;
    }
    return map;
  };

  function mapVariant(v, raw, battery) {
    return {
      id: v.id,
      title: v.title,
      o1: v.o1,
      o2: v.o2,
      o3: v.o3,
      price: ctx.roundMRU(v.price ?? raw.price),
      compare: ctx.roundMRU(v.compare ?? raw.compare),
      available: v.available !== false,
      battery: battery ?? 0
    };
  }

  function discountedCompare(raw) {
    if (ctx.roundMRU(raw.compare) > ctx.roundMRU(raw.price)) return ctx.roundMRU(raw.compare);
    return 0;
  }

  function discountedPercent(raw) {
    if (!(ctx.roundMRU(raw.compare) > ctx.roundMRU(raw.price))) return 0;
    return Math.round((1 - ctx.roundMRU(raw.price) / ctx.roundMRU(raw.compare)) * 100);
  }

  function defaultCondition(p) {
    return optionValue(p, /condition|état/i) || (p.compare ? "Excellent" : "Good");
  }

  function buildProduct(raw, index) {
    const seed = hashHandle(raw.handle);
    const p = priceProduct(raw);
    const stock = 2 + (seed % 17);
    const battery = p.type === "Smartphone" ? Math.min(100, 84 + (seed % 16)) : null;
    return {
      ...p,
      variants: (raw.variants || []).map((v) => mapVariant(v, raw, battery)),
      price: ctx.roundMRU(raw.price),
      compare: discountedCompare(raw),
      discount: discountedPercent(raw),
      stock,
      active: true,
      battery,
      condition: defaultCondition(p),
      description: productDescriptions(p.type),
      includes: includesFor(p),
      specs: specsFor(p, battery || 92),
      colorImages: colorImageMap(p),
      colorRemote: remoteColorMap(raw),
      sku: `RS-${String(index + 1).padStart(4, "0")}`,
      warrantyMonths: 12,
      lowStock: stock <= 2
    };
  }

  function buildProducts() {
    return ctx.RAW.products.map(buildProduct);
  }

  return { buildProducts, specsFor, includesFor };
}
