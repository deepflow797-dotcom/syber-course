// @ts-check
/* state.js → Default editorial content (CMS pages, press, blog). Pure data from window.BRAND; see 01-default-texts.js. */

export function install(ctx) {
  const B = window.BRAND || {};
  const BN = { ar: B.name?.ar || "متجر", fr: B.name?.fr || "Store" };
  const bt = (ar, fr) => ctx.txt(ar.split("{brand}").join(BN.ar), fr.split("{brand}").join(BN.fr));
  const DEFAULT_PAGES = [
    [
      "about-us",
      "من نحن",
      "À propos",
      BN.ar +
        " متجر موريتاني متخصص في الإلكترونيات المجددة. نشتري الأجهزة المستعملة، نفحصها ونعيد تأهيلها ثم نبيعها بأسعار عادلة مع ضمان واضح.\nنعمل من نواكشوط ونوصل إلى جميع ولايات موريتانيا.\nهدفنا أن يحصل كل شخص على تقنية موثوقة بدون أن يدفع ثمن جهاز جديد.",
      BN.fr +
        " est une boutique mauritanienne spécialisée dans l’électronique reconditionnée. Nous rachetons, contrôlons et remettons en état les appareils avant de les revendre à un prix juste avec une garantie claire.\nNous travaillons depuis Nouakchott et livrons dans toutes les wilayas de Mauritanie.\nNotre objectif : rendre la technologie fiable accessible sans payer le prix du neuf."
    ],
    [
      "help",
      "مركز المساعدة والأسئلة الشائعة",
      "Centre d’aide et FAQ",
      "تحتاج مساعدة؟ فريق " +
        BN.ar +
        " متاح من الأحد إلى الخميس، من 9:00 إلى 19:00.\nراسلنا على واتساب أو اتصل على الرقم المؤقت " +
        (B.phoneDisplay || "") +
        ".\nيمكنك أيضًا زيارة صفحة تتبع الطلب أو تقديم طلب ضمان.",
      "Besoin d’aide ? L’équipe " +
        BN.fr +
        " est disponible du dimanche au jeudi, de 9h00 à 19h00.\nÉcrivez-nous sur WhatsApp ou appelez le numéro temporaire " +
        (B.phoneDisplay || "") +
        ".\nVous pouvez aussi suivre une commande ou ouvrir une demande de garantie."
    ],
    [
      "contact",
      "اتصل بنا",
      "Contact",
      "العنوان: نواكشوط، موريتانيا\nواتساب: " +
        (B.phoneDisplay || "") +
        "\nالبريد: " +
        (B.email || "") +
        "\nساعات العمل: 9:00 صباحًا إلى 19:00 مساءً",
      "Adresse : Nouakchott, Mauritanie\nWhatsApp : " +
        (B.phoneDisplay || "") +
        "\nE-mail : " +
        (B.email || "") +
        "\nHoraires : 9h00 à 19h00"
    ],
    [
      "terms",
      "الشروط والأحكام",
      "Conditions générales",
      "باستخدامك موقع " +
        BN.ar +
        " فإنك توافق على شروط البيع هذه. الأسعار معروضة بالأوقية الجديدة وتشمل الضريبة حيث تنطبق.\nيتم تأكيد كل طلب عبر واتساب قبل الشحن. تحتفظ " +
        BN.ar +
        " بحق إلغاء أي طلب إذا لم يتوفر المنتج أو إذا كانت المعلومات غير صحيحة.\nالصور توضيحية وقد يختلف لون الجهاز قليلًا.",
      "En utilisant le site " +
        BN.fr +
        ", vous acceptez les présentes conditions de vente. Les prix sont affichés en nouvelle ouguiya et incluent les taxes applicables.\nChaque commande est confirmée via WhatsApp avant expédition. " +
        BN.fr +
        " peut annuler une commande en cas de rupture de stock ou d’informations erronées.\nLes photos sont indicatives ; la teinte de l’appareil peut légèrement varier."
    ],
    [
      "legal",
      "السياسة القانونية",
      "Mentions légales",
      BN.ar +
        " اسم تجاري لمتجر إلكترونيات مجدد في موريتانيا. جميع العلامات التجارية المذكورة مملوكة لأصحابها.\nمحتوى هذا الموقع وصوره وبياناته قابلة للتعديل من لوحة التحكم. يجب مراجعة النصوص القانونية مع مستشار مختص قبل الإطلاق التجاري.",
      BN.fr +
        " est une enseigne d’électronique reconditionnée en Mauritanie. Toutes les marques citées appartiennent à leurs propriétaires.\nLe contenu, les images et les données du site peuvent être modifiés depuis le tableau de bord. Faites réviser les textes juridiques par un professionnel avant un lancement commercial."
    ],
    [
      "privacy",
      "سياسة الخصوصية",
      "Politique de confidentialité",
      "نجمع فقط المعلومات اللازمة لمعالجة طلبك: الاسم، رقم الهاتف، المدينة والعنوان.\nتُرسل بيانات الطلب إلى واتساب المتجر. لا نبيع بياناتك لأي طرف ثالث.\nيمكنك طلب حذف بياناتك بمراسلتنا على " +
        (B.email || "") +
        ".",
      "Nous collectons uniquement les informations nécessaires au traitement de votre commande : nom, téléphone, ville et adresse.\nLes données de commande sont envoyées au WhatsApp de la boutique. Nous ne vendons pas vos données à des tiers.\nVous pouvez demander leur suppression en écrivant à " +
        (B.email || "") +
        "."
    ],
    [
      "track-order",
      "تتبع طلبك",
      "Suivre votre commande",
      "بعد تأكيد الطلب عبر واتساب سنرسل لك رقم التتبع ورابط شركة الشحن.\nإذا لم يصلك أي تحديث خلال 24 ساعة، راسلنا على واتساب مع رقم الطلب.",
      "Après confirmation de la commande sur WhatsApp, nous vous envoyons le numéro de suivi et le lien du transporteur.\nSi vous n’avez aucune nouvelle sous 24 heures, écrivez-nous sur WhatsApp avec votre numéro de commande."
    ],
    [
      "raise-claim",
      "تقديم طلب ضمان",
      "Ouvrir une demande de garantie",
      "كل جهاز مشمول بضمان 12 شهرًا يغطي عيوب التصنيع أو الأعطال غير الناتجة عن سوء الاستخدام.\nأرسل رقم الطلب، وصف العطل، وصورة أو فيديو قصير عبر واتساب.",
      "Chaque appareil bénéficie d’une garantie de 12 mois couvrant les défauts de fabrication ou les pannes non liées à un mauvais usage.\nEnvoyez le numéro de commande, une description du problème et une courte photo ou vidéo via WhatsApp."
    ],
    [
      "track-claim",
      "متابعة طلب الضمان",
      "Suivi de garantie",
      "بعد فتح طلب الضمان ستحصل على رقم متابعة. مدة المعالجة المعتادة من 3 إلى 7 أيام عمل.\nراسل الدعم على واتساب إذا احتجت تحديثًا.",
      "Après l’ouverture d’une demande de garantie, vous recevez un numéro de suivi. Le délai habituel est de 3 à 7 jours ouvrés.\nContactez le support sur WhatsApp pour toute mise à jour."
    ],
    [
      "blog",
      "مدونة " + BN.ar,
      "Le blog " + BN.fr,
      "نصائح لاختيار هاتف مجدد، مقارنات بين الأجهزة، وطرق العناية بالبطارية.\nاقرأ أحدث المقالات من لوحة التحكم أو من قسم المدونة.",
      "Conseils pour choisir un téléphone reconditionné, comparatifs et astuces pour préserver la batterie.\nRetrouvez les derniers articles dans la section blog."
    ],
    [
      "become-a-seller",
      "كن بائعًا معنا",
      "Devenir vendeur",
      "هل لديك أجهزة إلكترونية تريد بيعها؟ نشتري الهواتف والحواسيب والأجهزة اللوحية بعد فحصها.\nراسلنا على واتساب مع نوع الجهاز وحالته وصور له.",
      "Vous avez des appareils à revendre ? Nous rachetons téléphones, ordinateurs et tablettes après contrôle.\nContactez-nous sur WhatsApp avec le modèle, l’état et quelques photos."
    ],
    [
      "for-businesses",
      "حلول للشركات",
      "Solutions entreprises",
      "نوفر أجهزة مجددة للشركات والمدارس والمنظمات بأسعار خاصة وضمان موحد.\nاطلب عرض سعر لكمية من 10 أجهزة أو أكثر.",
      "Nous fournissons des appareils reconditionnés aux entreprises, écoles et organisations à tarifs préférentiels avec une garantie unique.\nDemandez un devis pour 10 appareils ou plus."
    ],
    [
      "renewed",
      "ما معنى مجدد من " + BN.ar + "؟",
      "Que signifie reconditionné chez " + BN.fr + " ?",
      "الجهاز المجدد هو جهاز مستعمل تم فحصه وتنظيفه وإصلاح ما يلزم فيه ليعمل كجهاز جديد.\nنفحص الشاشة، البطارية، الكاميرا، الصوت، المنافذ والاتصال، ثم نمسح البيانات ونثبت النظام.\nكل جهاز يأتي بضمان 12 شهرًا، توصيل مجاني داخل نواكشوط، وإمكانية الإرجاع خلال 10 أيام.",
      "Un appareil reconditionné est un appareil d’occasion contrôlé, nettoyé et réparé si nécessaire pour fonctionner comme neuf.\nNous vérifions l’écran, la batterie, les caméras, le son, les ports et la connectivité, puis nous effaçons les données et installons le système.\nChaque appareil est livré avec 12 mois de garantie, la livraison gratuite à Nouakchott et un retour possible sous 10 jours."
    ],
    [
      "shipping",
      "الشحن والتوصيل",
      "Livraison",
      "التوصيل مجاني داخل نواكشوط. إلى المدن الأخرى تُضاف رسوم حسب الولاية وتظهر عند إتمام الطلب.\nالطلبات المؤكدة قبل الساعة 16:00 تُجهز عادة في نفس اليوم، والتوصيل داخل نواكشوط من 1 إلى 2 يوم عمل.",
      "La livraison est gratuite à Nouakchott. Pour les autres villes, des frais selon la wilaya sont ajoutés et affichés au moment de la commande.\nLes commandes confirmées avant 16h00 sont généralement préparées le jour même ; la livraison à Nouakchott prend 1 à 2 jours ouvrés."
    ],
    [
      "returns",
      "الإرجاع والضمان",
      "Retours et garantie",
      "لديك 10 أيام لاختبار الجهاز وإرجاعه إذا لم يعجبك، بشرط أن يكون في حالته الأصلية.\nالضمان 12 شهرًا يغطي الأعطال التقنية، ولا يغطي الكسر أو دخول الماء أو سوء الاستخدام.\nلبدء الإرجاع راسلنا على واتساب مع رقم الطلب.",
      "Vous disposez de 10 jours pour tester l’appareil et le retourner s’il ne vous convient pas, à condition qu’il soit dans son état d’origine.\nLa garantie de 12 mois couvre les pannes techniques, hors casse, dégâts d’eau ou mauvais usage.\nPour un retour, contactez-nous sur WhatsApp avec votre numéro de commande."
    ]
  ].map(([slug, ar, fr, bodyAr, bodyFr]) => ({
    slug,
    title: ctx.name(ar, fr),
    body: ctx.txt(bodyAr, bodyFr),
    visible: true,
    seoTitle: ctx.name(ar, fr)
  }));

  const DEFAULT_PRESS = [
    {
      id: "p1",
      outlet: ctx.txt("تِك صحارى", "Tech Sahara"),
      quote: bt(
        "{brand} يعيد تعريف سوق الإلكترونيات المجددة في موريتانيا بأسعار شفافة وضمان حقيقي.",
        "{brand} redéfinit le marché du reconditionné en Mauritanie avec des prix transparents et une vraie garantie."
      )
    },
    {
      id: "p2",
      outlet: ctx.txt("نواكشوط بيزنس", "Nouakchott Business"),
      quote: ctx.txt(
        "منصة محلية تربط المستهلك بأجهزة موثوقة وتقلل النفايات الإلكترونية.",
        "Une plateforme locale qui connecte les consommateurs à des appareils fiables et réduit les déchets électroniques."
      )
    },
    {
      id: "p3",
      outlet: ctx.txt("الرؤية", "La Vision"),
      quote: ctx.txt(
        "تجربة شراء رقمية بالعربية والفرنسية مع دفع محلي وتوصيل لكل الولايات.",
        "Une expérience d’achat numérique en arabe et en français, avec paiement local et livraison dans toutes les wilayas."
      )
    }
  ];

  const DEFAULT_BLOG = [
    {
      id: "b1",
      slug: "choisir-telephone-reconditionne",
      title: ctx.txt(
        "كيف تختار هاتفًا مجددًا دون أن تقع في الفخ؟",
        "Comment choisir un téléphone reconditionné sans se tromper ?"
      ),
      excerpt: ctx.txt(
        "خمسة معايير مهمة قبل الشراء: البطارية، الحالة، الضمان، المصدر، وسياسة الإرجاع.",
        "Cinq critères essentiels : batterie, état, garantie, provenance et politique de retour."
      ),
      body: ctx.txt(
        "ابدأ دائمًا بصحة البطارية. نسبة 85% فما فوق جيدة للاستخدام اليومي.\nتأكد من وجود ضمان مكتوب وسياسة إرجاع واضحة.\nاسأل عن الحالة الفعلية للجهاز واطلب صورًا حقيقية.\nقارن السعر بالسوق ولا تنسَ تكلفة الشحن.",
        "Commencez toujours par la santé de la batterie. Au-dessus de 85 %, elle convient à un usage quotidien.\nExigez une garantie écrite et une politique de retour claire.\nDemandez l’état réel de l’appareil et des photos authentiques.\nComparez le prix au marché et pensez aux frais de livraison."
      ),
      image: "assets/img/category-iphone.svg",
      date: "2026-09-12",
      published: true
    },
    {
      id: "b2",
      slug: "macbook-ou-pc-portable",
      title: ctx.txt("ماك بوك أم حاسوب ويندوز؟ دليل مبسط", "MacBook ou PC portable ? Le guide simple"),
      excerpt: ctx.txt(
        "أيهما يناسب الدراسة والعمل والبرامج التي تحتاجها؟",
        "Lequel convient aux études, au travail et à vos logiciels ?"
      ),
      body: ctx.txt(
        "اختر MacBook إذا كنت تعمل على التصميم أو المونتاج أو تريد عمر بطارية طويل.\nاختر حاسوب ويندوز إذا كنت تحتاج برامج هندسية أو محاسبية خاصة أو ميزانية أقل.\nفي الحالتين، تحقق من صحة البطارية والمنافذ ولوحة المفاتيح.",
        "Choisissez un MacBook pour le design, le montage ou une longue autonomie.\nChoisissez un PC Windows pour certains logiciels d’ingénierie, de comptabilité ou un budget plus serré.\nDans les deux cas, vérifiez la batterie, les ports et le clavier."
      ),
      image: "assets/img/category-macbooks.svg",
      date: "2026-08-28",
      published: true
    },
    {
      id: "b3",
      slug: "entretenir-batterie",
      title: ctx.txt("سبع عادات تطيل عمر بطارية هاتفك", "Sept habitudes qui prolongent la batterie de votre téléphone"),
      excerpt: ctx.txt(
        "نصائح عملية لشحن أذكى واستخدام أطول.",
        "Des conseils concrets pour charger plus intelligemment."
      ),
      body: ctx.txt(
        "حافظ على الشحن بين 20% و80% عندما يكون ذلك ممكنًا.\nتجنب الحرارة العالية أثناء الشحن.\nاستخدم شاحنًا أصليًا أو معتمدًا.\nلا تترك الهاتف مشحونًا 100% طوال الليل.",
        "Gardez la charge entre 20 % et 80 % lorsque c’est possible.\nÉvitez la chaleur pendant la charge.\nUtilisez un chargeur d’origine ou certifié.\nNe laissez pas le téléphone à 100 % toute la nuit."
      ),
      image: "assets/img/category-chargers.svg",
      date: "2026-07-19",
      published: true
    }
  ];

  Object.assign(ctx, { DEFAULT_PAGES, DEFAULT_PRESS, DEFAULT_BLOG });
}
