# دليل التسليم — متجر Restore

> اقرأ هذا الملف أولًا. كل ما تحتاجه لإدارة المتجر أو نقله أو استعادته موجود هنا أو في ملف واحد مرتبط به.
> النسخة الإنجليزية من نفس المحتوى في الأسفل.

## 1. أين أعدّل ماذا؟

| أريد أن أعدّل | الملف / المكان | ملاحظة |
| --- | --- | --- |
| اسم المتجر، الشعار، الهاتف، العنوان، الألوان، العملة | **لوحة التحكم ▸ الإعدادات** ثم **نشر** | لا تعدّل HTML لهذا الغرض |
| المنتجات، الأقسام، الكوبونات | لوحة التحكم ▸ المنتجات / التسويق | في وضع Supabase تُحفظ في جداول قاعدة البيانات |
| النصوص التسويقية، الأقسام، التقييمات | لوحة التحكم ▸ المحتوى / الصفحة الرئيسية | |
| الصفحات (من نحن، الشروط…) والمدونة | لوحة التحكم ▸ الصفحات / المدونة | |
| هوية المتجر الثابتة (اسم قانوني، نطاق، معرفات بكسلات) | `assets/js/brand.config.js` | ثم `npm run brand` و `npm run build` |
| رابط Supabase والمفتاح العام | `.env` → `npm run build` | يُولّد `assets/js/config.js` |
| قواعد الأمان والجداول | `supabase/migrations/` | تُطبّق يدويًا في SQL Editor عند الإعداد فقط |

**ممنوع تمامًا:** وضع مفتاح `service_role` في أي ملف يصل للمتصفح. المفتاح المسموح هو `anon` فقط (انظر `scripts/doctor.mjs` الذي يفشل إذا ظهر).

## 2. النشر (Vercel أو GitHub Pages)

1. `npm ci` ثم `npm run build` (يقرأ `.env` ويكتب `config.js` والـ manifest).
   لقاعدة البيانات: `npm run sql` يبني `supabase/ALL_IN_ONE.sql` (المخطط + كل الترحيلات + كتالوج تجريبي)، الصقه كاملًا
   في Supabase ▸ SQL Editor ▸ Run مرة واحدة؛ تكراره آمن.
2. `npm run check` — يجب أن ينتهي بـ exit 0 قبل أي نشر.
3. `npm run doctor` — يفحص المجلد قبل الرفع: ملفات ناقصة، سياسة CSP، أيقونات، Service Worker.
4. ارفع المجلد كما هو. لا يوجد خطوة بناء على الخادم؛ الموقع ملفات ثابتة.
5. بعد النشر: افتح المتجر ولوحة التحكم مرة، وسجّل دخول لوحة التحكم لتأكيد أن Supabase مربوط.

**سياسة الأمان (CSP):** موجودة في ثلاثة أماكن ويجب أن تتطابق حرفيًا: `vercel.json` و `_headers` و `<meta>` في كل صفحة HTML.
GitHub Pages لا يقرأ `_headers`، لذلك الـ `<meta>` هو الحماية الفعلية هناك. `npm run lint` يفشل إذا تباعدت النسخ.

## 3. النسخ الاحتياطي والاستعادة

**من لوحة التحكم (الأسهل):** الإعدادات ▸ متقدم ▸ **نسخة احتياطية**.

- **تنزيل نسخة:** ملف JSON واحد يحتوي الإعدادات والمنتجات والأقسام والصفحات والمدونة والتقييمات.
- **استيراد نسخة:** يظهر ملخّص ودقيق قبل أي كتابة (عدد المنتجات والصفحات، وما سيتغير)، ثم تختار **دمج** أو **استبدال**.
  قبل التطبيق تُحفظ نسخة من الحالة الحالية، وزر **تراجع** يعيدها فورًا.
- الملف يحمل إصدار تنسيق، فنسخة من إصدار أقدم تُقبل، ونسخة من إصدار أحدث تُرفض برسالة واضحة بدلًا من إفساد البيانات.

**من قاعدة البيانات (الطريقة الكاملة):** `docs/BACKUP.md` — `pg_dump` للجداول + تخزين خارج المشروع + تشفير.

## 4. عند حدوث خطأ

1. **المتجر لا يفتح:** `npm run doctor` ثم اقرأ سطور `FAIL`.
2. **المنتجات اختفت:** لوحة التحكم ▸ المنتجات. إن كانت فارغة، استورد آخر نسخة احتياطية (القسم 3).
3. **الطلبات لا تُسجّل:** تأكد من تطبيق كل ملفات `supabase/migrations/` بالترتيب في SQL Editor.
4. **تعديل خاطئ في لوحة التحكم:** **إلغاء المسودة** يرجع لآخر نشر، أو **استيراد** نسخة سابقة.
5. **تحديث القالب:** `docs/UPDATING.md` — يحافظ على ملفات المتجر الخاصة.

## 5. ما تم التحقق منه (لا مجرد ادعاء)

| ما | كيف | النتيجة |
| --- | --- | --- |
| كل الصفحات تعمل بلا أخطاء | `npm test` + `npm run test:smoke` | 128 اختبار + كل الصفحات |
| تجربة الشراء كاملة | `npm run test:e2e` | 8 سيناريوهات (شراء، لوحة تحكم، نشر منتج، موافقة الكوكيز، نسخ احتياطي) |
| استيراد نسخة يعيد البيانات كما هي | `e2e/05-backup.spec.mjs` | تصدير ← تعديل ← استيراد ← مطابقة تامة |
| ثبات التصميم (لا يقفز) | `reports/evidence/p3-*` | CLS 0.765 → 0.017 |
| لا أنماط سطرية تخرق CSP | `npm run lint` | 0 مخالفة |
| الأداء | `reports/tools/perf-metrics.mjs` | 48–68 كيلوبايت للصفحة كاملة |

---

# Handover (English)

## Where to change what

Store name, logo, phone, address, colours and currency → **dashboard ▸ Settings ▸ Publish** (never edit HTML for these).
Products, collections and coupons → dashboard ▸ Products / Marketing (kept in Supabase tables when connected).
Permanent brand identity and tracking IDs → `assets/js/brand.config.js`, then `npm run brand && npm run build`.
Supabase URL and **anon** key → `.env`, then `npm run build`. The `service_role` key must never reach the browser.

## Deploy

`npm ci` → `npm run build` → `npm run sql` (builds `supabase/ALL_IN_ONE.sql`, one paste for the database) → `npm run check`
(must exit 0) → `npm run doctor` → upload the folder. Static hosting, no
server build step. The CSP lives in three places that must match byte for byte — `vercel.json`, `_headers`, and a
`<meta>` in every page (GitHub Pages ignores `_headers`, so the meta tag is the real policy there); `npm run lint` fails
if they drift.

## Back up and restore

Dashboard ▸ Settings ▸ Advanced ▸ **Backup**: download one JSON file with settings, products, collections, sections,
pages, blog and reviews. Import shows a diff before writing anything and offers *merge* or *replace*; the pre-import
state is snapshotted and the **undo** button restores it. Newer format versions are refused with a readable message
instead of corrupting the store. For a full database backup see `docs/BACKUP.md`.

## When something breaks

`npm run doctor` first, then read the `FAIL` lines. Lost products → import the last backup. Orders not recording → apply
every file in `supabase/migrations/` in order. Bad dashboard edit → cancel the draft, or import the previous backup.
Template updates → `docs/UPDATING.md`.
