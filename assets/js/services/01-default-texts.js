// @ts-check
/* state.js → Default texts (FAQ, reviews, navigation, categories, payments, cities, templates).
   Pure data built from window.BRAND; consumed by 01a-default-state.js (buildState / hydrate). */

/**
 * Builds the default text constants for one `ctx`.
 * @param {Record<string, any>} ctx shared state context
 */
export function createDefaultTexts(ctx) {
  const B = window.BRAND || {};
  const BN = { ar: B.name?.ar || "متجر", fr: B.name?.fr || "Store" };
  const bt = (ar, fr) => ctx.txt(ar.split("{brand}").join(BN.ar), fr.split("{brand}").join(BN.fr));

  function descriptions() {
    return {
      Smartphone: bt(
        "هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء {brand}. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.",
        "Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts {brand}. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."
      ),
      Laptop: ctx.txt(
        "حاسوب محمول مجدد تم اختباره مكونًا بمكون. يصلح للعمل والدراسة والاستخدام اليومي، مع ضمان 12 شهرًا.",
        "Ordinateur portable reconditionné, testé composant par composant. Idéal pour le travail, les études et l’usage quotidien, avec 12 mois de garantie."
      ),
      Macbook: bt(
        "MacBook مجدد مع macOS مثبت وجاهز للاستخدام. تم فحص البطارية ولوحة المفاتيح والمنافذ بواسطة خبراء {brand}.",
        "MacBook reconditionné avec macOS installé et prêt à l’emploi. Batterie, clavier et ports vérifiés par les experts {brand}."
      ),
      Tablets: ctx.txt(
        "جهاز لوحي مجدد تم فحصه بالكامل، مناسب للقراءة والعمل والترفيه، ويأتي بضمان 12 شهرًا.",
        "Tablette reconditionnée entièrement vérifiée, idéale pour lire, travailler et se divertir, avec 12 mois de garantie."
      ),
      Playstation: ctx.txt(
        "جهاز ألعاب مجدد تم اختباره وتنظيفه، ويأتي مع ملحقاته الأساسية وضمان 12 شهرًا.",
        "Console de jeu reconditionnée, testée et nettoyée, livrée avec ses accessoires essentiels et 12 mois de garantie."
      ),
      "Apple Watch": ctx.txt(
        "ساعة Apple مجددة تم فحص البطارية والشاشة والحساسات، وتأتي بضمان 12 شهرًا.",
        "Apple Watch reconditionnée : batterie, écran et capteurs vérifiés, avec 12 mois de garantie."
      ),
      Accessories: ctx.txt(
        "ملحق أصلي مجدد أو جديد، تم فحصه لضمان التوافق والجودة.",
        "Accessoire d’origine reconditionné ou neuf, contrôlé pour garantir compatibilité et qualité."
      )
    };
  }

  function faqs() {
    return [
      {
        id: "faq-1",
        q: ctx.txt("هل الأجهزة جديدة أم مستعملة؟", "Les appareils sont-ils neufs ou d’occasion ?"),
        a: ctx.txt(
          "الأجهزة مجددة: مستعملة، لكنها مفحوصة ومصلحة ومعاد تأهيلها لتكون جاهزة للاستخدام.",
          "Les appareils sont reconditionnés : d’occasion, mais contrôlés, réparés et remis en état pour être prêts à l’emploi."
        )
      },
      {
        id: "faq-2",
        q: ctx.txt("ما مدة الضمان؟", "Quelle est la durée de la garantie ?"),
        a: ctx.txt(
          "كل جهاز يأتي بضمان 12 شهرًا يغطي الأعطال التقنية غير الناتجة عن سوء الاستخدام.",
          "Chaque appareil bénéficie de 12 mois de garantie couvrant les pannes techniques hors mauvais usage."
        )
      },
      {
        id: "faq-3",
        q: ctx.txt("هل يمكنني الإرجاع؟", "Puis-je retourner l’appareil ?"),
        a: ctx.txt(
          "نعم، لديك 10 أيام لإرجاع الجهاز في حالته الأصلية إذا لم يعجبك.",
          "Oui, vous avez 10 jours pour retourner l’appareil dans son état d’origine s’il ne vous convient pas."
        )
      },
      {
        id: "faq-4",
        q: ctx.txt("هل التوصيل مجاني؟", "La livraison est-elle gratuite ?"),
        a: ctx.txt(
          "التوصيل مجاني داخل نواكشوط. المدن الأخرى لها رسوم تظهر عند إتمام الطلب.",
          "La livraison est gratuite à Nouakchott. Les autres villes ont des frais affichés lors de la commande."
        )
      },
      {
        id: "faq-5",
        q: ctx.txt("كيف أدفع؟", "Comment payer ?"),
        a: ctx.txt(
          "يمكنك الدفع عبر بنكيلي، مصرفي، سداد، كليك أو نقدًا عند الاستلام. الدفع عبر بنكيلي يمنحك خصمًا 10%.",
          "Vous pouvez payer via Bankily, Masrvi, Sedad, Click ou en espèces à la livraison. Le paiement Bankily offre 10 % de réduction."
        )
      },
      {
        id: "faq-6",
        q: ctx.txt("هل البطارية أصلية؟", "La batterie est-elle d’origine ?"),
        a: ctx.txt(
          "نفحص صحة البطارية ونعرض النسبة على صفحة المنتج. البطاريات المستبدلة تكون معتمدة ومضمونة.",
          "Nous contrôlons la santé de la batterie et affichons le pourcentage sur la fiche produit. Les batteries remplacées sont certifiées et garanties."
        )
      }
    ];
  }

  /** City of a demo review, defaulting to the store city. */
  function reviewCity() {
    return { ar: B.city?.ar || "نواكشوط", fr: B.city?.fr || "Nouakchott" };
  }

  function homeReviews() {
    const city = reviewCity();
    return [
      {
        id: "r1",
        name: "أحمد ولد محمد",
        city,
        rating: 5,
        title: ctx.txt("جهاز نظيف وخدمة سريعة", "Appareil impeccable et service rapide"),
        body: ctx.txt(
          "وصلني الآيفون في حالة ممتازة، البطارية 96% والدفع عبر بنكيلي كان سهلًا.",
          "J’ai reçu l’iPhone en excellent état, batterie à 96 %, et le paiement Bankily était simple."
        ),
        color: "#2e7d6f"
      },
      {
        id: "r2",
        name: "مريم بنت أحمد",
        city,
        rating: 5,
        title: ctx.txt("أفضل تجربة شراء", "Ma meilleure expérience d’achat"),
        body: ctx.txt(
          "طلبت ماك بوك للدراسة، وصل بسرعة ومع macOS مثبت. أنصح به بشدة.",
          "J’ai commandé un MacBook pour mes études, livré rapidement avec macOS installé. Je recommande."
        ),
        color: "#6c5ce7"
      },
      {
        id: "r3",
        name: "الشيخ ولد سيدي",
        city: ctx.txt("نواذيبو", "Nouadhibou"),
        rating: 4,
        title: ctx.txt("قيمة ممتازة", "Excellent rapport qualité-prix"),
        body: ctx.txt(
          "اللابتوب يعمل بشكل جيد جدًا، والتوصيل إلى نواذيبو أخذ يومين.",
          "Le laptop fonctionne très bien, la livraison à Nouadhibou a pris deux jours."
        ),
        color: "#b06ab3"
      },
      {
        id: "r4",
        name: "فاطمة بنت عبد الله",
        city: ctx.txt("كيفة", "Kiffa"),
        rating: 5,
        title: ctx.txt("ثقة وشفافية", "Confiance et transparence"),
        body: ctx.txt(
          "أعجبني أنهم يظهرون نسبة البطارية والحالة قبل الشراء. الجهاز مطابق للوصف.",
          "J’aime qu’ils affichent la santé de la batterie et l’état avant l’achat. L’appareil correspond à la description."
        ),
        color: "#e17055"
      },
      {
        id: "r5",
        name: "محمد الأمين",
        city,
        rating: 5,
        title: ctx.txt("خدمة واتساب رائعة", "Service WhatsApp au top"),
        body: ctx.txt(
          "أجابوني على كل الأسئلة عبر واتساب وأرسلوا لي صورًا إضافية للجهاز.",
          "Ils ont répondu à toutes mes questions sur WhatsApp et m’ont envoyé des photos supplémentaires."
        ),
        color: "#1e6fd9"
      },
      {
        id: "r6",
        name: "عائشة بنت بابا",
        city: ctx.txt("روصو", "Rosso"),
        rating: 4,
        title: ctx.txt("سأشتري مرة أخرى", "Je rachèterai"),
        body: ctx.txt(
          "الساعة وصلت بحالة جيدة، فقط التغليف كان بسيطًا. الخدمة تستحق التجربة.",
          "La montre est arrivée en bon état, l’emballage était simple. Le service mérite le détour."
        ),
        color: "#2d3436"
      },
      {
        id: "r7",
        name: "سيدي محمد",
        city: ctx.txt("أطار", "Atar"),
        rating: 5,
        title: ctx.txt("جهاز موثوق", "Appareil fiable"),
        body: ctx.txt(
          "حاسوب Dell مجدد يعمل بسرعة، والضمان أعطاني راحة البال.",
          "Le Dell reconditionné est rapide, et la garantie me rassure."
        ),
        color: "#00b894"
      },
      {
        id: "r8",
        name: "خديجة بنت المختار",
        city,
        rating: 5,
        title: ctx.txt("أنصح الجميع", "Je recommande à tous"),
        body: ctx.txt(
          "اشتريت جهازين للعائلة، كلاهما ممتاز والسعر أفضل من الجديد.",
          "J’ai acheté deux appareils pour la famille, tous deux excellents et bien moins chers que le neuf."
        ),
        color: "#d63031"
      }
    ];
  }

  function nav() {
    return [
      {
        id: "anniversary",
        label: bt("{brand} أنيفرساري", "Anniversaire {brand}"),
        href: "collection.html?handle=restore-anniversary",
        flame: true,
        visible: true
      },
      {
        id: "iphones",
        label: ctx.txt("آيفون", "iPhones"),
        href: "collection.html?handle=refurbished-iphones",
        visible: true,
        sub: [
          { label: ctx.txt("سلسلة iPhone 16", "iPhone 16"), href: "collection.html?q=iPhone%2016" },
          { label: ctx.txt("سلسلة iPhone 15", "iPhone 15"), href: "collection.html?q=iPhone%2015" },
          { label: ctx.txt("سلسلة iPhone 14", "iPhone 14"), href: "collection.html?q=iPhone%2014" },
          { label: ctx.txt("سلسلة iPhone 13", "iPhone 13"), href: "collection.html?q=iPhone%2013" },
          { label: ctx.txt("سلسلة iPhone 12", "iPhone 12"), href: "collection.html?q=iPhone%2012" },
          { label: ctx.txt("سلسلة iPhone 11", "iPhone 11"), href: "collection.html?q=iPhone%2011" }
        ]
      },
      {
        id: "samsung",
        label: ctx.txt("سامسونج", "Samsung"),
        href: "collection.html?handle=used-samsung",
        visible: true,
        sub: [
          { label: ctx.txt("سلسلة Galaxy S24", "Galaxy S24"), href: "collection.html?q=S24" },
          { label: ctx.txt("سلسلة Galaxy S23", "Galaxy S23"), href: "collection.html?q=S23" },
          { label: ctx.txt("سلسلة Galaxy S22", "Galaxy S22"), href: "collection.html?q=S22" },
          { label: ctx.txt("سلسلة Galaxy S21", "Galaxy S21"), href: "collection.html?q=S21" },
          { label: ctx.txt("سلسلة Galaxy S20", "Galaxy S20"), href: "collection.html?q=S20" },
          { label: ctx.txt("سلسلة Galaxy Z", "Galaxy Z"), href: "collection.html?q=Z%20Fold" },
          { label: ctx.txt("سلسلة Galaxy Note", "Galaxy Note"), href: "collection.html?q=Note" }
        ]
      },
      {
        id: "macbooks",
        label: ctx.txt("ماك بوك", "MacBooks"),
        href: "collection.html?handle=refurbished-macbooks",
        visible: true,
        sub: [
          { label: ctx.txt("MacBook Pro", "MacBook Pro"), href: "collection.html?q=MacBook%20Pro" },
          { label: ctx.txt("MacBook Air", "MacBook Air"), href: "collection.html?q=MacBook%20Air" },
          { label: ctx.txt("iMac", "iMac"), href: "collection.html?q=iMac" }
        ]
      },
      {
        id: "laptops",
        label: ctx.txt("حواسيب محمولة", "Laptops"),
        href: "collection.html?handle=laptops-used-refurbished",
        visible: true,
        sub: [
          { label: "Lenovo", href: "collection.html?q=Lenovo" },
          { label: "Dell", href: "collection.html?q=Dell" },
          { label: "HP", href: "collection.html?q=HP" },
          { label: "Acer", href: "collection.html?q=Acer" }
        ]
      },
      { id: "ipads", label: ctx.txt("آيباد", "iPads"), href: "collection.html?handle=ipads", visible: true },
      {
        id: "accessories",
        label: ctx.txt("ملحقات وصوتيات", "Accessoires et audio"),
        href: "collection.html?handle=audio",
        visible: true,
        sub: [
          { label: ctx.txt("صوتيات", "Audio"), href: "collection.html?handle=audio" },
          {
            label: ctx.txt("شواحن وكابلات", "Chargeurs et câbles"),
            href: "collection.html?handle=chargers-power-banks-cables"
          },
          { label: ctx.txt("ألعاب", "Gaming"), href: "collection.html?handle=gaming" },
          { label: ctx.txt("ملحقات", "Accessoires"), href: "collection.html?handle=cases-screen-protectors" }
        ]
      },
      {
        id: "watches",
        label: ctx.txt("ساعة آبل", "Apple Watch"),
        href: "collection.html?handle=apple-watches",
        visible: true
      },
      {
        id: "business",
        label: ctx.txt("للشركات", "Entreprises"),
        href: "page.html?slug=for-businesses",
        visible: true
      },
      { id: "help", label: ctx.txt("تحتاج مساعدة؟", "Besoin d’aide ?"), href: "page.html?slug=help", visible: true },
      {
        id: "seller",
        label: ctx.txt("كن بائعًا", "Devenir vendeur"),
        href: "page.html?slug=become-a-seller",
        visible: true
      }
    ];
  }

  function collectionTitles() {
    return {
      "restore-anniversary": bt("{brand} أنيفرساري", "Anniversaire {brand}"),
      "refurbished-iphones": ctx.txt("آيفون مجدد معتمد", "iPhone reconditionnés certifiés"),
      "used-samsung": ctx.txt("سامسونج مجدد معتمد", "Samsung reconditionnés certifiés"),
      "laptops-used-refurbished": ctx.txt("حواسيب محمولة مجددة", "Ordinateurs portables reconditionnés"),
      "refurbished-macbooks": ctx.txt("ماك بوك مجدد", "MacBook reconditionnés"),
      ipads: ctx.txt("آيباد مجدد", "iPad reconditionnés"),
      "apple-watches": ctx.txt("ساعات آبل", "Montres Apple"),
      audio: ctx.txt("صوتيات", "Audio"),
      "chargers-power-banks-cables": ctx.txt("شواحن وبطاريات وكابلات", "Chargeurs, batteries et câbles"),
      gaming: ctx.txt("ألعاب", "Gaming"),
      "cases-screen-protectors": ctx.txt("محافظ وواقيات شاشة", "Coques et protections d’écran")
    };
  }

  function categories() {
    return [
      {
        label: bt("{brand} أنيفرساري", "{brand} Anniversary"),
        handle: "restore-anniversary",
        image: "assets/img/category-anniversary.svg"
      },
      { label: ctx.txt("آيفون", "iPhone"), handle: "refurbished-iphones", image: "assets/img/category-iphone.svg" },
      { label: ctx.txt("سامسونج", "Samsung"), handle: "used-samsung", image: "assets/img/category-samsung.svg" },
      {
        label: ctx.txt("ماك بوك", "MacBooks"),
        handle: "refurbished-macbooks",
        image: "assets/img/category-macbooks.svg"
      },
      {
        label: ctx.txt("حواسيب محمولة", "Laptops"),
        handle: "laptops-used-refurbished",
        image: "assets/img/category-laptops.svg"
      },
      { label: ctx.txt("آيباد", "iPads"), handle: "ipads", image: "assets/img/category-ipads.svg" },
      {
        label: ctx.txt("ساعات آبل", "Apple Watches"),
        handle: "apple-watches",
        image: "assets/img/category-watches.svg"
      },
      { label: ctx.txt("صوتيات", "Audio"), handle: "audio", image: "assets/img/category-audio.svg" },
      {
        label: ctx.txt("شواحن وكابلات", "Chargeurs et câbles"),
        handle: "chargers-power-banks-cables",
        image: "assets/img/category-chargers.svg"
      },
      { label: ctx.txt("ألعاب", "Gaming"), handle: "gaming", image: "assets/img/category-gaming.svg" },
      {
        label: ctx.txt("ملحقات", "Accessoires"),
        handle: "cases-screen-protectors",
        image: "assets/img/category-accessories.svg"
      }
    ];
  }

  function payments() {
    return [
      {
        id: "bankily",
        name: ctx.txt("بنكيلي", "Bankily"),
        color: "#00a651",
        active: true,
        discount: 10,
        note: ctx.txt("خصم 10% عند الدفع عبر بنكيلي", "10 % de réduction avec Bankily")
      },
      {
        id: "masrvi",
        name: ctx.txt("مصرفي", "Masrvi"),
        color: "#0b6fb8",
        active: true,
        discount: 0,
        note: ctx.txt("تحويل فوري عبر مصرفي", "Paiement instantané via Masrvi")
      },
      {
        id: "sedad",
        name: ctx.txt("سداد", "Sedad"),
        color: "#6f42c1",
        active: true,
        discount: 0,
        note: ctx.txt("الدفع عبر تطبيق سداد", "Paiement avec l’application Sedad")
      },
      {
        id: "click",
        name: ctx.txt("كليك", "Click"),
        color: "#e67e22",
        active: true,
        discount: 0,
        note: ctx.txt("الدفع عبر كليك", "Paiement avec Click")
      },
      {
        id: "cod",
        name: ctx.txt("الدفع عند الاستلام", "Paiement à la livraison"),
        color: "#2d3436",
        active: true,
        discount: 0,
        note: ctx.txt("ادفع نقدًا عند استلام طلبك", "Payez en espèces à la réception")
      }
    ];
  }

  function cities() {
    return [
      {
        id: "nouakchott",
        name: ctx.txt("نواكشوط", "Nouakchott"),
        fee: 0,
        days: ctx.txt("1–2 أيام", "1–2 jours"),
        active: true
      },
      {
        id: "nouadhibou",
        name: ctx.txt("نواذيبو", "Nouadhibou"),
        fee: 500,
        days: ctx.txt("2–3 أيام", "2–3 jours"),
        active: true
      },
      { id: "rosso", name: ctx.txt("روصو", "Rosso"), fee: 600, days: ctx.txt("2–3 أيام", "2–3 jours"), active: true },
      { id: "kiffa", name: ctx.txt("كيفة", "Kiffa"), fee: 800, days: ctx.txt("3–5 أيام", "3–5 jours"), active: true },
      { id: "kaedi", name: ctx.txt("كيهيدي", "Kaédi"), fee: 700, days: ctx.txt("3–5 أيام", "3–5 jours"), active: true },
      { id: "atar", name: ctx.txt("أطار", "Atar"), fee: 900, days: ctx.txt("3–5 أيام", "3–5 jours"), active: true },
      {
        id: "zouerat",
        name: ctx.txt("الزويرات", "Zouérat"),
        fee: 1200,
        days: ctx.txt("4–6 أيام", "4–6 jours"),
        active: true
      },
      { id: "nema", name: ctx.txt("النعمة", "Néma"), fee: 1200, days: ctx.txt("4–7 أيام", "4–7 jours"), active: true },
      {
        id: "tidjikja",
        name: ctx.txt("تجكجة", "Tidjikja"),
        fee: 1000,
        days: ctx.txt("3–5 أيام", "3–5 jours"),
        active: true
      },
      {
        id: "selibaby",
        name: ctx.txt("سيليبابي", "Sélibaby"),
        fee: 900,
        days: ctx.txt("4–6 أيام", "4–6 jours"),
        active: true
      },
      { id: "aleg", name: ctx.txt("ألاك", "Aleg"), fee: 700, days: ctx.txt("3–5 أيام", "3–5 jours"), active: true },
      {
        id: "boutilimit",
        name: ctx.txt("بوتلميت", "Boutilimit"),
        fee: 500,
        days: ctx.txt("2–4 أيام", "2–4 jours"),
        active: true
      }
    ];
  }

  function orderTemplate() {
    return {
      ar: "مرحباً {store} 👋\nأريد تأكيد هذا الطلب:\n\nرقم الطلب: {order_id}\nالاسم: {name}\nالهاتف: {phone}\nالمدينة: {city}\nالعنوان: {address}\nطريقة الدفع: {payment}\n\nالمنتجات:\n{items}\n\nالمجموع الفرعي: {subtotal}\nالشحن: {shipping}\nالخصم: {discount}\nالإجمالي: {total}\n\nملاحظات: {notes}",
      fr: "Bonjour {store} 👋\nJe souhaite confirmer cette commande :\n\nN° de commande : {order_id}\nNom : {name}\nTéléphone : {phone}\nVille : {city}\nAdresse : {address}\nPaiement : {payment}\n\nProduits :\n{items}\n\nSous-total : {subtotal}\nLivraison : {shipping}\nRéduction : {discount}\nTotal : {total}\n\nNotes : {notes}"
    };
  }

  function whatsappTemplates() {
    return {
      confirm: {
        ar: "مرحباً {name}، تم تأكيد طلبك {order_id} من {store}. سنبدأ تجهيزه ونخبرك عند الشحن. شكراً لثقتك!",
        fr: "Bonjour {name}, votre commande {order_id} chez {store} est confirmée. Nous préparons votre colis et vous informerons dès l’expédition. Merci !"
      },
      shipped: {
        ar: "مرحباً {name}، طلبك {order_id} تم شحنه وهو في الطريق إليك. سنوافيك برقم التتبع قريباً.",
        fr: "Bonjour {name}, votre commande {order_id} a été expédiée et est en route. Nous vous enverrons le numéro de suivi très bientôt."
      },
      delivered: {
        ar: "مرحباً {name}، نأمل أن تكون راضياً عن طلبك {order_id}. إذا احتجت أي مساعدة أو ضمان، راسلنا هنا.",
        fr: "Bonjour {name}, nous espérons que votre commande {order_id} vous satisfait. Pour toute aide ou garantie, écrivez-nous ici."
      }
    };
  }

  return {
    TYPE_DESCRIPTIONS: descriptions(),
    DEFAULT_FAQS: faqs(),
    DEFAULT_HOME_REVIEWS: homeReviews(),
    DEFAULT_NAV: nav(),
    COLLECTION_TITLES: collectionTitles(),
    DEFAULT_CATEGORIES: categories(),
    DEFAULT_PAYMENTS: payments(),
    DEFAULT_CITIES: cities(),
    DEFAULT_ORDER_TEMPLATE: orderTemplate(),
    DEFAULT_WHATSAPP_TEMPLATES: whatsappTemplates()
  };
}

/** Registers the default text constants on `ctx` (called by state.js before the content builders). */
export function install(ctx) {
  Object.assign(ctx, createDefaultTexts(ctx));
}
