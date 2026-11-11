// @ts-check
/* state.js → Default store state (settings tree, demo products, collections).
   Pure builders: no DOM access, no storage. `hydrate` in 01-default-content.js merges saved data over these. */

import { createProductBuilders } from "./01b-default-products.js";

/**
 * Builds the default state builders for one `ctx`.
 * @param {Record<string, any>} ctx shared state context
 */
export function createDefaultState(ctx) {
  const products = createProductBuilders(ctx);
  const B = window.BRAND || {};
  const BN = { ar: B.name?.ar || "متجر", fr: B.name?.fr || "Store" };
  const bt = (ar, fr) => ctx.txt(ar.split("{brand}").join(BN.ar), fr.split("{brand}").join(BN.fr));
  const {
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

  const DEFAULT_COLORS = { primary: "#2563eb", ink: "#0f172a", purple: "#7c3aed", lavender: "#eef2ff" };

  function brandColors() {
    return Object.assign({}, DEFAULT_COLORS, B.colors || {});
  }

  function brandNames() {
    return {
      storeName: { ar: BN.ar, fr: BN.fr },
      legalName: { ar: B.legalName?.ar || BN.ar, fr: B.legalName?.fr || BN.fr },
      tagline: { ar: B.tagline?.ar || "", fr: B.tagline?.fr || "" }
    };
  }

  function brandAssets() {
    return {
      logo: B.logo || "assets/img/brand-logo.svg",
      logoWhite: B.logoWhite || "assets/img/brand-logo-white.svg",
      favicon: B.favicon || "assets/img/favicon.svg"
    };
  }

  function brandSettings() {
    return { ...brandNames(), ...brandAssets(), colors: brandColors(), font: B.font || "Montserrat", radius: 10 };
  }

  function countryName() {
    const name = B.country?.name || { ar: "", fr: "" };
    return { ar: name.ar || "موريتانيا", fr: name.fr || "Mauritanie" };
  }

  function countryCurrency() {
    const country = B.country || {};
    return {
      currency: country.currency || { ar: "أوقية", fr: "MRU" },
      currencyName: country.currencyName || { ar: "أوقية جديدة", fr: "Nouvelle ouguiya" }
    };
  }

  function countrySettings() {
    const { currency, currencyName } = countryCurrency();
    return {
      country: {
        code: B.country?.code || "MR",
        name: countryName(),
        flag: B.country?.flag || "assets/img/flag-mr.svg",
        dial: B.country?.dial || "+222",
        currencyCode: B.country?.currencyCode || "MRU",
        currency,
        currencyName,
        currencyMode: "new"
      }
    };
  }

  function openingHours() {
    return { open: "00:00", close: "23:59", days: [0, 1, 2, 3, 4, 5, 6], closed: false, maintenance: false };
  }

  /** Store address, city and contact channels (everything the footer/top bar reads). */
  function citySetting() {
    return { ar: B.city?.ar || "نواكشوط", fr: B.city?.fr || "Nouakchott" };
  }

  function addressSetting() {
    return { ar: B.address?.ar || "", fr: B.address?.fr || "" };
  }

  function phoneSettings() {
    return {
      phone: B.phone || "",
      phoneDisplay: B.phoneDisplay || B.phone || "",
      whatsapp: B.whatsapp || "",
      email: B.email || ""
    };
  }

  function contactSettings() {
    return {
      city: citySetting(),
      address: addressSetting(),
      timezone: B.timezone || "Africa/Nouakchott",
      ...phoneSettings()
    };
  }

  function localeSettings() {
    return { ...contactSettings(), hours: openingHours() };
  }

  function identitySettings() {
    return { ...brandSettings(), ...countrySettings(), ...localeSettings() };
  }

  function contentSettings() {
    return {
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
          text: ctx.txt("خدمة عملاء تجيب على أسئلتك وتتابع طلبك", "Un service client qui répond et suit votre commande")
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
      navigation: DEFAULT_NAV
    };
  }

  function footerSettings() {
    return {
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
      ]
    };
  }

  function homeSectionSettings() {
    return {
      homeSections: [
        {
          id: "anniversary",
          visible: true,
          order: 1,
          title: bt("{brand} أنيفرساري", "{brand} Anniversary"),
          collection: "restore-anniversary",
          handles: ctx.RAW.home.anniversary,
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
          handles: ctx.RAW.home.iphones,
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
          handles: ctx.RAW.home.samsung,
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
          handles: ctx.RAW.home.laptops,
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
      ]
    };
  }

  function promoSettings() {
    return {
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
      ]
    };
  }

  function miscSettings() {
    return {
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
    };
  }

  function buildSettings() {
    return {
      ...identitySettings(),
      ...contentSettings(),
      ...footerSettings(),
      ...homeSectionSettings(),
      ...promoSettings(),
      ...miscSettings()
    };
  }

  /** Title of a saved collection, re-localised from the default table. */
  function collectionTitle(collection) {
    return COLLECTION_TITLES[collection.handle] || ctx.txt(collection.title, collection.title);
  }

  function collectionList() {
    return ctx.RAW.collections.map((c) => ({
      handle: c.handle,
      title: COLLECTION_TITLES[c.handle] || ctx.txt(c.title, c.title),
      visible: true
    }));
  }

  function homeHandles() {
    return {
      anniversary: ctx.RAW.home.anniversary,
      iphones: ctx.RAW.home.iphones,
      samsung: ctx.RAW.home.samsung,
      laptops: ctx.RAW.home.laptops
    };
  }

  function buildState() {
    return {
      version: 1,
      updatedAt: ctx.nowISO(),
      settings: buildSettings(),
      products: products.buildProducts(),
      collections: collectionList(),
      home: homeHandles(),
      theme: { categories: DEFAULT_CATEGORIES },
      pages: DEFAULT_PAGES,
      faqs: DEFAULT_FAQS,
      homeReviews: DEFAULT_HOME_REVIEWS,
      press: DEFAULT_PRESS,
      blog: DEFAULT_BLOG,
      reviews: []
    };
  }
  return { buildState, specsFor: products.specsFor, includesFor: products.includesFor, collectionTitle };
}
