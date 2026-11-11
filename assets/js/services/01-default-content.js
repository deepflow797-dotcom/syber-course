// @ts-check
/* state.js → Default content: demo products, buildState, hydrate, i18n helpers (texts live in 01-default-texts.js)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */
import { t as tI18n, L as LI18n } from "../i18n/index.js";

export function install(ctx) {
  const B = window.BRAND || {};
  const BN = { ar: B.name?.ar || "متجر", fr: B.name?.fr || "Store" };
  const bt = (ar, fr) => ctx.txt(ar.split("{brand}").join(BN.ar), fr.split("{brand}").join(BN.fr));
  Object.assign(ctx, {
    productDescriptions,
    hashHandle,
    includesFor,
    specsFor,
    priceProduct,
    buildProducts,
    buildState,
    hydrate,
    t,
    money,
    formatDate,
    setLang,
    setTheme
  });
  const {
    TYPE_DESCRIPTIONS,
    DEFAULT_PAGES,
    DEFAULT_FAQS,
    DEFAULT_HOME_REVIEWS,
    DEFAULT_PRESS,
    DEFAULT_BLOG,
    DEFAULT_NAV,
    COLLECTION_TITLES,
    DEFAULT_CATEGORIES,
    DEFAULT_PAYMENTS,
    DEFAULT_CITIES,
    DEFAULT_ORDER_TEMPLATE,
    DEFAULT_WHATSAPP_TEMPLATES
  } = ctx;
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

  function specsFor(p, battery) {
    const title = p.title || "";
    const cpuOpt = p.options?.find((o) => /cpu/i.test(o.name));
    const ramOpt = p.options?.find((o) => /ram/i.test(o.name));
    const storageOpt = p.options?.find((o) => /storage/i.test(o.name));
    const isMac = p.type === "Macbook";
    const isLaptop = p.type === "Laptop" || isMac;
    const isPhone = p.type === "Smartphone";
    const cpuFromTitle = title.match(/(Core i[3579][^,/(-]*|M[1234](?: Pro| Max)?|Ryzen [3579][^,/(-]*)/i)?.[0];
    const cpu =
      cpuOpt?.values?.[0] ||
      cpuFromTitle ||
      (isMac ? "Apple Silicon" : isLaptop ? "Intel Core i5" : isPhone ? "SoC" : "—");
    const ram = ramOpt?.values?.[0] || (isLaptop ? (isMac ? "8 GB" : "8 GB") : isPhone ? "6 GB" : "—");
    const storage = storageOpt?.values?.[0] || (isPhone ? "128 GB" : isLaptop ? "256 GB SSD" : "—");
    const screen = isMac
      ? '13.3"'
      : isLaptop
        ? '14"'
        : isPhone
          ? '6.1"'
          : p.type === "Tablets"
            ? '10.2"'
            : p.type === "Apple Watch"
              ? "45 mm"
              : "—";
    const keyboard = isLaptop ? ctx.txt("فرنسي AZERTY", "Français AZERTY") : null;
    const condition = p.options?.find((o) => /condition|état/i.test(o.name))?.values?.[0] || "Excellent";
    return {
      cpu: {
        label: ctx.txt("المعالج", "Processeur"),
        value: cpu,
        choices: isLaptop ? [cpu, "Intel Core i7", "Intel Core i5", "Apple M1", "Apple M2"] : []
      },
      ram: {
        label: ctx.txt("الذاكرة", "Mémoire RAM"),
        value: ram,
        choices: isLaptop ? [ram, "8 GB", "16 GB", "32 GB"] : []
      },
      storage: { label: ctx.txt("التخزين", "Stockage"), value: storage, choices: [] },
      screen: {
        label: ctx.txt("حجم الشاشة", "Taille d’écran"),
        value: screen,
        choices: isLaptop ? [screen, '13.3"', '14"', '15.6"', '16"'] : isPhone ? ['5.8"', '6.1"', '6.7"'] : []
      },
      keyboard: {
        label: ctx.txt("لوحة المفاتيح", "Clavier"),
        value: keyboard,
        choices: isLaptop ? ["Français AZERTY", "QWERTY (US)", "Arabe / Anglais"] : []
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

  function buildProducts() {
    return ctx.RAW.products.map((raw, index) => {
      const seed = hashHandle(raw.handle);
      const p = priceProduct(raw);
      const stock = 2 + (seed % 17);
      const batteryBase = 84 + (seed % 16);
      const battery = p.type === "Smartphone" ? Math.min(100, batteryBase) : null;
      const condition =
        p.options?.find((o) => /condition|état/i.test(o.name))?.values?.[0] || (p.compare ? "Excellent" : "Good");
      const colorRemote = {};
      for (const v of raw.variants || []) {
        const alt = v.image?.alt;
        if (alt && v.image?.src) colorRemote[alt] = v.image.src;
      }
      const colors = p.colors || [];
      const colorImages = {};
      colors.forEach((c, i) => {
        colorImages[c.name] = p.images?.length ? p.images[Math.min(i, p.images.length - 1)] : p.image;
      });
      const variants = (raw.variants || []).map((v) => ({
        id: v.id,
        title: v.title,
        o1: v.o1,
        o2: v.o2,
        o3: v.o3,
        price: ctx.roundMRU(v.price ?? raw.price),
        compare: ctx.roundMRU(v.compare ?? raw.compare),
        available: v.available !== false,
        battery: battery ?? 0
      }));
      return {
        ...p,
        variants,
        price: ctx.roundMRU(raw.price),
        compare: ctx.roundMRU(raw.compare) > ctx.roundMRU(raw.price) ? ctx.roundMRU(raw.compare) : 0,
        discount:
          ctx.roundMRU(raw.compare) > ctx.roundMRU(raw.price)
            ? Math.round((1 - ctx.roundMRU(raw.price) / ctx.roundMRU(raw.compare)) * 100)
            : 0,
        stock,
        active: true,
        battery,
        condition,
        description: productDescriptions(p.type),
        includes: includesFor(p),
        specs: specsFor(p, battery || 92),
        colorImages,
        colorRemote,
        sku: `RS-${String(index + 1).padStart(4, "0")}`,
        warrantyMonths: 12,
        lowStock: stock <= 2
      };
    });
  }

  function buildState() {
    const products = buildProducts();
    const collections = ctx.RAW.collections.map((c) => ({
      handle: c.handle,
      title: COLLECTION_TITLES[c.handle] || ctx.txt(c.title, c.title),
      visible: true
    }));
    const home = {
      anniversary: ctx.RAW.home.anniversary,
      iphones: ctx.RAW.home.iphones,
      samsung: ctx.RAW.home.samsung,
      laptops: ctx.RAW.home.laptops
    };
    return {
      version: 1,
      updatedAt: ctx.nowISO(),
      settings: {
        storeName: { ar: BN.ar, fr: BN.fr },
        legalName: { ar: B.legalName?.ar || BN.ar, fr: B.legalName?.fr || BN.fr },
        tagline: { ar: B.tagline?.ar || "", fr: B.tagline?.fr || "" },
        logo: B.logo || "assets/img/brand-logo.svg",
        logoWhite: B.logoWhite || "assets/img/brand-logo-white.svg",
        favicon: B.favicon || "assets/img/favicon.svg",
        colors: Object.assign(
          { primary: "#2563eb", ink: "#0f172a", purple: "#7c3aed", lavender: "#eef2ff" },
          B.colors || {}
        ),
        font: B.font || "Montserrat",
        radius: 10,
        country: {
          code: B.country?.code || "MR",
          name: { ar: B.country?.name?.ar || "موريتانيا", fr: B.country?.name?.fr || "Mauritanie" },
          flag: B.country?.flag || "assets/img/flag-mr.svg",
          dial: B.country?.dial || "+222",
          currencyCode: B.country?.currencyCode || "MRU",
          currency: { ar: B.country?.currency?.ar || "أوقية", fr: B.country?.currency?.fr || "MRU" },
          currencyName: {
            ar: B.country?.currencyName?.ar || "أوقية جديدة",
            fr: B.country?.currencyName?.fr || "Nouvelle ouguiya"
          },
          currencyMode: "new"
        },
        city: { ar: B.city?.ar || "نواكشوط", fr: B.city?.fr || "Nouakchott" },
        address: { ar: B.address?.ar || "", fr: B.address?.fr || "" },
        timezone: B.timezone || "Africa/Nouakchott",
        phone: B.phone || "",
        phoneDisplay: B.phoneDisplay || B.phone || "",
        whatsapp: B.whatsapp || "",
        email: B.email || "",
        hours: { open: "00:00", close: "23:59", days: [0, 1, 2, 3, 4, 5, 6], closed: false, maintenance: false },
        announcement: ctx.txt(
          "توصيل مجاني داخل نواكشوط • خصم 10% عند الدفع عبر بنكيلي",
          "Livraison gratuite à Nouakchott • -10 % avec Bankily"
        ),
        renewalText: bt("ما معنى مجدد من {brand}؟", "Que signifie reconditionné chez {brand} ?"),
        categoriesTitle: ctx.txt("تسوق الإلكترونيات المجددة", "Électronique reconditionnée"),
        serviceTitle: ctx.txt(
          "كل أجهزتنا أصلية ومفحوصة من طرف خبراء",
          "Tous nos appareils sont originaux et vérifiés par des experts"
        ),
        serviceItems: [
          {
            icon: "smile",
            title: ctx.txt("بدون مخاطرة", "Sans risque"),
            text: ctx.txt(
              "10 أيام لإرجاع الجهاز عند وجود أي مشكلة",
              "10 jours pour retourner l’appareil en cas de problème"
            )
          },
          {
            icon: "badgeCheck",
            title: ctx.txt("فحص جهازًا بجهاز", "Vérifié un par un"),
            text: ctx.txt(
              "50 نقطة فحص تشمل الشاشة، البطارية، السرعة والمتانة",
              "50 points de contrôle : écran, batterie, vitesse et durabilité"
            )
          },
          {
            icon: "star",
            title: ctx.txt("أفضل الموردين فقط", "Seulement les meilleurs"),
            text: ctx.txt(
              "نقبل موردًا واحدًا من كل أربعة بعد فحص صارم",
              "Nous acceptons un fournisseur sur quatre après un contrôle strict"
            )
          },
          {
            icon: "chat",
            title: ctx.txt("دائمًا معك", "Toujours là pour vous"),
            text: ctx.txt(
              "خدمة عملاء تجيب على أسئلتك وتتابع طلبك",
              "Un service client qui répond et suit votre commande"
            )
          }
        ],
        trustTitle: ctx.txt("150,000+ عميل يثقون بنا", "150 000+ clients nous font confiance"),
        communityTitle: bt("انضم إلى مجتمع {brand}", "Rejoignez la communauté {brand}"),
        reviewsTitle: ctx.txt("ماذا يقول عملاؤنا", "Ce que disent nos clients"),
        pressTitle: bt("{brand} في الأخبار", "{brand} dans la presse"),
        trustBar: [
          { icon: "truck", label: ctx.txt("توصيل مجاني داخل نواكشوط", "Livraison gratuite à Nouakchott") },
          { icon: "shield", label: ctx.txt("ضمان 12 شهرًا", "Garantie 12 mois") },
          { icon: "return", label: ctx.txt("إرجاع خلال 10 أيام", "Retour sous 10 jours") },
          { icon: "badgeCheck", label: ctx.txt("فحص بواسطة خبراء", "Vérifié par des experts") }
        ],
        paymentOffer: ctx.txt("اشترِ عبر بنكيلي واحصل على خصم 10%", "Payez avec Bankily et obtenez 10 % de réduction"),
        paymentOfferCode: "BANKILY10",
        shippingNote: ctx.txt(
          "رسوم الشحن تُحسب حسب المدينة عند إتمام الطلب.",
          "Les frais de livraison sont calculés selon la ville lors de la commande."
        ),
        freeShippingOver: 20000,
        cities: DEFAULT_CITIES,
        payments: DEFAULT_PAYMENTS,
        navigation: DEFAULT_NAV,
        footerColumns: [
          {
            title: ctx.txt("من نحن", "À propos"),
            links: [
              { label: ctx.txt("من نحن", "À propos"), href: "page.html?slug=about-us" },
              { label: ctx.txt("تسوق الآن", "Boutique"), href: "collection.html?handle=all" },
              { label: ctx.txt("مدونتنا", "Notre blog"), href: "blog.html" },
              { label: ctx.txt("كن بائعًا", "Devenir vendeur"), href: "page.html?slug=become-a-seller" }
            ]
          },
          {
            title: ctx.txt("معلومات", "Informations"),
            links: [
              { label: ctx.txt("مركز المساعدة", "Centre d’aide"), href: "page.html?slug=help" },
              { label: ctx.txt("اتصل بنا", "Contact"), href: "page.html?slug=contact" },
              { label: ctx.txt("الشروط والأحكام", "Conditions générales"), href: "page.html?slug=terms" },
              { label: ctx.txt("سياسة الخصوصية", "Confidentialité"), href: "page.html?slug=privacy" }
            ]
          },
          {
            title: ctx.txt("حسابي", "Mon compte"),
            links: [
              { label: ctx.txt("حسابي", "Mon compte"), href: "account.html" },
              { label: ctx.txt("تتبع الطلب", "Suivre ma commande"), href: "page.html?slug=track-order" },
              { label: ctx.txt("طلب ضمان", "Demande de garantie"), href: "page.html?slug=raise-claim" },
              { label: ctx.txt("متابعة الضمان", "Suivi de garantie"), href: "page.html?slug=track-claim" }
            ]
          }
        ],
        social: [
          { id: "facebook", href: "https://www.facebook.com/", icon: "facebook" },
          { id: "instagram", href: "https://www.instagram.com/", icon: "instagram" },
          { id: "tiktok", href: "https://www.tiktok.com/", icon: "tiktok" }
        ],
        homeSections: [
          {
            id: "anniversary",
            visible: true,
            order: 1,
            title: bt("{brand} أنيفرساري", "{brand} Anniversary"),
            collection: "restore-anniversary",
            handles: home.anniversary,
            layout: "plain",
            promo: "",
            flame: true
          },
          {
            id: "iphones",
            visible: true,
            order: 2,
            title: ctx.txt("آيفون مجدد معتمد", "iPhones reconditionnés certifiés"),
            collection: "refurbished-iphones",
            handles: home.iphones,
            layout: "left",
            promo: "assets/img/restore/promo-iphone.svg",
            flame: false
          },
          {
            id: "samsung",
            visible: true,
            order: 3,
            title: ctx.txt("سامسونج مجدد معتمد", "Samsung reconditionné certifié"),
            collection: "used-samsung",
            handles: home.samsung,
            layout: "right",
            promo: "assets/img/restore/promo-samsung.svg",
            flame: false
          },
          {
            id: "laptops",
            visible: true,
            order: 4,
            title: ctx.txt("حواسيب محمولة مجددة", "Ordinateurs portables reconditionnés"),
            collection: "laptops-used-refurbished",
            handles: home.laptops,
            layout: "left",
            promo: "assets/img/restore/promo-laptops.svg",
            flame: false
          }
        ],
        pageSections: [
          { id: "hero", visible: true, order: 1 },
          { id: "trust", visible: true, order: 2 },
          { id: "renewed", visible: true, order: 3 },
          { id: "categories", visible: true, order: 4 },
          { id: "offer", visible: true, order: 5 },
          { id: "products", visible: true, order: 6 },
          { id: "sustain", visible: true, order: 7 },
          { id: "service", visible: true, order: 8 },
          { id: "video", visible: true, order: 9 },
          { id: "reviews", visible: true, order: 10 },
          { id: "press", visible: true, order: 11 }
        ],
        heroSlides: [
          {
            id: "hero-1",
            visible: true,
            title: ctx.txt("تقنية مجددة، ثقة جديدة", "La tech reconditionnée, en toute confiance"),
            subtitle: ctx.txt(
              "هواتف وحواسيب مفحوصة بضمان 12 شهرًا، وتوصيل لكل موريتانيا.",
              "Téléphones et ordinateurs contrôlés, garantis 12 mois et livrés partout en Mauritanie."
            ),
            cta: ctx.txt("تسوق الآن", "Découvrir"),
            href: "collection.html?handle=all",
            image: "assets/img/hero-iphone.svg",
            bg: "linear-gradient(135deg,#1f1f2e 0%,#39255b 55%,#ff6400 130%)"
          },
          {
            id: "hero-2",
            visible: true,
            title: ctx.txt("ماك بوك جاهز للعمل", "MacBook prêt à travailler"),
            subtitle: ctx.txt(
              "macOS مثبت، بطارية مفحوصة، ولوحة مفاتيح بالعربية أو الفرنسية.",
              "macOS installé, batterie contrôlée et clavier arabe ou français."
            ),
            cta: ctx.txt("اكتشف ماك بوك", "Voir les MacBook"),
            href: "collection.html?handle=refurbished-macbooks",
            image: "assets/img/hero-macbook.svg",
            bg: "linear-gradient(135deg,#eef3ff 0%,#d9e5ff 45%,#f7c7ff 120%)",
            dark: false
          }
        ],
        offers: [
          {
            id: "bankily",
            active: true,
            title: ctx.txt("خصم 10% عند الدفع عبر بنكيلي", "10 % de réduction avec Bankily"),
            subtitle: ctx.txt(
              "اختر بنكيلي عند إتمام الطلب وسيُطبّق الخصم تلقائيًا.",
              "Choisissez Bankily au paiement, la réduction s’applique automatiquement."
            ),
            code: "BANKILY10",
            href: "collection.html?handle=all",
            startsAt: "",
            endsAt: new Date(Date.now() + 7 * 864e5).toISOString()
          }
        ],
        coupons: [
          {
            id: "c1",
            code: (B.couponPrefix || "WELCOME") + "10",
            type: "percent",
            value: 10,
            active: true,
            minTotal: 0,
            expiresAt: ""
          },
          { id: "c2", code: "NOUAKCHOTT5", type: "percent", value: 5, active: true, minTotal: 10000, expiresAt: "" }
        ],
        seo: {
          title: bt(
            "{brand} | إلكترونيات مجددة موثوقة في موريتانيا",
            "{brand} | Électronique reconditionnée en Mauritanie"
          ),
          description: ctx.txt(
            "اشترِ هواتف وحواسيب مجددة مفحوصة في موريتانيا مع ضمان 12 شهرًا، توصيل سريع ودفع عبر بنكيلي ومصرفي وسداد.",
            "Achetez téléphones et ordinateurs reconditionnés en Mauritanie avec 12 mois de garantie, livraison rapide et paiement Bankily, Masrvi ou Sedad."
          )
        },
        pixels: { meta: "", tiktok: "", ga: "" },
        orderTemplate: DEFAULT_ORDER_TEMPLATE,
        whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES,
        otp: { enabled: false },
        blocklist: [],
        rateLimitSeconds: 60,
        lowStockThreshold: 2,
        autoHideOutOfStock: true,
        pwa: true,
        fakeData: true
      },
      products,
      collections,
      home,
      theme: { categories: DEFAULT_CATEGORIES },
      pages: DEFAULT_PAGES,
      faqs: DEFAULT_FAQS,
      homeReviews: DEFAULT_HOME_REVIEWS,
      press: DEFAULT_PRESS,
      blog: DEFAULT_BLOG,
      reviews: []
    };
  }

  function hydrate(saved) {
    const base = buildState();
    if (!saved) return base;
    const out = ctx.merge(base, saved);
    const baseProducts = new Map(base.products.map((p) => [p.handle, p]));
    out.products = (saved.products || base.products).map((p) => ctx.merge(baseProducts.get(p.handle) || {}, p));
    out.collections = (saved.collections || base.collections).map((c) => {
      const merged = ctx.merge(base.collections.find((x) => x.handle === c.handle) || {}, c);
      if (typeof merged.title === "string")
        merged.title = COLLECTION_TITLES[merged.handle] || ctx.txt(merged.title, merged.title);
      return merged;
    });
    out.pages = (saved.pages || base.pages).map((p) => ctx.merge(base.pages.find((x) => x.slug === p.slug) || {}, p));
    out.blog = (saved.blog || base.blog).map((b) => ctx.merge(base.blog.find((x) => x.slug === b.slug) || {}, b));
    out.settings.homeSections = (saved.settings?.homeSections || base.settings.homeSections).map((s) =>
      ctx.merge(base.settings.homeSections.find((x) => x.id === s.id) || {}, s)
    );
    out.settings.navigation = (saved.settings?.navigation || base.settings.navigation).map((n) =>
      ctx.merge(base.settings.navigation.find((x) => x.id === n.id) || {}, n)
    );
    out.settings.pageSections = (saved.settings?.pageSections || base.settings.pageSections).map((s) =>
      ctx.merge(base.settings.pageSections.find((x) => x.id === s.id) || {}, s)
    );
    out.products.forEach((p) => {
      if (!p.specs) p.specs = specsFor(p, p.battery || 92);
      if (!p.includes) p.includes = includesFor(p);
      if (!p.description) p.description = productDescriptions(p.type);
      if (!p.colorImages) p.colorImages = {};
      if (!p.colorRemote) p.colorRemote = {};
    });
    return out;
  }
  // I18N moved to ./i18n/ar.js, ./i18n/fr.js (single source of truth)

  const LANG_KEY = "lang";
  ctx.lang = localStorage.getItem(ctx.LS_LANG) === "fr" ? "fr" : "ar";
  ctx.theme = localStorage.getItem(ctx.LS_THEME) === "dark" ? "dark" : "light";

  function t(key, vars = {}) {
    return tI18n(ctx.lang, key, vars);
  }
  const L = (value) => LI18n(ctx.lang, value);
  function money(n) {
    return ctx.formatCurrency(n);
  }
  /** @param {string | number | Date} value @param {Intl.DateTimeFormatOptions} [opts] */
  function formatDate(value, opts = { year: "numeric", month: "short", day: "numeric" }) {
    try {
      return new Intl.DateTimeFormat(ctx.lang === "ar" ? "ar-MR" : "fr-MR", opts).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  function setLang(next) {
    ctx.lang = next === "fr" ? "fr" : "ar";
    localStorage.setItem(ctx.LS_LANG, ctx.lang);
    ctx.applyDocument();
    window.dispatchEvent(new CustomEvent("restore:lang", { detail: ctx.lang }));
  }
  function setTheme(next) {
    ctx.theme = next === "dark" ? "dark" : "light";
    localStorage.setItem(ctx.LS_THEME, ctx.theme);
    ctx.applyDocument();
  }
  Object.assign(ctx, { LANG_KEY, L });
}
