/**
 * =============================================================================
 *  🧾 نظام تذكير الضرائب — بوت تيليجرام (Google Sheets + Google Apps Script)
 * =============================================================================
 *  ملف واحد فقط. لا يستخدم أي خدمة مدفوعة: يعمل بـ Apps Script + واجهة
 *  تيليجرام المجانية (Bot API).
 *
 *  الخطوات المختصرة (التفصيل خطوة بخطوة في الملف README-ar.md):
 *   0) جدول جديد؟ افتح https://sheets.new ثم الأوامر: الإضافات ← Apps Script،
 *      الصق هذا الملف، وشغّل setupSheet لبناء الورقتين والعناوين وخانات الاختيار.
 *   1) الصق هذا الملف كاملاً في محرر Apps Script الملحق بالجدول
 *      (من الجدول: الإضافات ← Apps Script)، ثم اضغط حفظ.
 *   2) شغّل الدالة  saveSpreadsheetId  مرة واحدة من المحرر
 *      (تحفظ معرّف الجدول في Script Properties — ضروري لأن تطبيق الويب
 *       لا يرى الجدول المفتوح تلقائياً). ملاحظة: setupSheet تفعل ذلك تلقائياً.
 *   3) من: إعدادات المشروع ← خصائص السكربت، أضف:
 *        TELEGRAM_TOKEN    = التوكن من @BotFather
 *        TELEGRAM_CHAT_ID  = رقم محادثتك (يمكن أكثر من رقم، مفصولاً بفاصلة)
 *   4) نشر ← نشر جديد ← تطبيق ويب:
 *        التنفيذ باسم: أنا (Me)   |   من يملك الوصول: أي شخص (Anyone)
 *      ثم شغّل الدالة  setWebhook  مرة واحدة.
 *   5) جرّب: sendTestMessage ← ثم sendMonthlyReminder ← ثم أرسل للبوت: دفع 1
 *
 *  ⚠️ بعد أي تعديل على الكود: نشر ← إدارة عمليات النشر ← تعديل ← نسخة جديدة
 *     (الرابط يبقى كما هو في هذه الطريقة).
 *
 *  الأوراق المتوقعة (الصف الأول = عناوين):
 *    «المتابعة»: الوحدة | الشقة | الوصل | تاريخ الاستحقاق | المبلغ | مدفوع
 *    «السنوية» : الوحدة | تاريخ الاستحقاق | المبلغ | مدفوع
 * =============================================================================
 */

/* ==========================================================================
 * 1) الثوابت — لا تحتاج لتغيير شيء هنا إن كانت أسماء أوراقك كما هي
 * ========================================================================== */

/** أسماء الأوراق في جدولك (غيّرها فقط إذا كانت مختلفة) */
var SHEET_MONTHLY = "المتابعة";
var SHEET_ANNUAL = "السنوية";

/** أرقام أعمدة ورقة «المتابعة» */
var M_UNIT = 1; // الوحدة
var M_APT = 2; // الشقة
var M_RECEIPT = 3; // الوصل
var M_DUE = 4; // تاريخ الاستحقاق
var M_AMOUNT = 5; // المبلغ
var M_PAID = 6; // مدفوع (خانة اختيار)

/** أرقام أعمدة ورقة «السنوية» */
var A_UNIT = 1; // الوحدة
var A_DUE = 2; // تاريخ الاستحقاق
var A_AMOUNT = 3; // المبلغ
var A_PAID = 4; // مدفوع (خانة اختيار)

/** كم صفاً في أعلى الورقة مخصص للعناوين (1 = الصف الأول فقط) */
var HEADER_ROWS = 1;

/** اسم العملة كما يظهر في الرسائل (اتركه فارغاً "" إذا لا تريدها) */
var CURRENCY = "أوقية";

/** أقصى طول لرسالة واحدة قبل تقسيمها (حد تيليجرام 4096 حرفاً، نترك هامش أمان) */
var MAX_MESSAGE_LENGTH = 4000;

/** أسماء الأشهر للعرض في الرسائل */
var MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر"
];

/** مفاتيح Script Properties (أسماء الخصائص كما تظهر في الإعدادات) */
var P_TOKEN = "TELEGRAM_TOKEN"; // توكن البوت
var P_CHAT = "TELEGRAM_CHAT_ID"; // رقم/أرقام المحادثات المسموحة
var P_USERS = "TELEGRAM_ALLOWED_USER_IDS"; // (اختياري) تقييد مستخدمين داخل المجموعة
var P_SECRET = "WEBHOOK_SECRET"; // (اختياري) سر الويب هوك
var P_URL = "WEBAPP_URL"; // (اختياري) رابط النشر إن أردت تثبيته يدوياً
var P_HINT = "SEND_CHAT_ID_HINT"; // (اختياري) اكتب «لا» لإيقاف إرسال رقم المحادثة للغرباء
var P_SHEET = "SPREADSHEET_ID"; // معرّف الجدول
var P_TIMEZONE = "TIMEZONE"; // (اختياري) مثل Africa/Nouakchott
var P_SEEN = "SEEN_UPDATE_IDS"; // آخر update_id عولجت (لمنع التكرار)
var P_MAP_META = "LAST_MAP_META"; // بيانات وصفية عن آخر تذكير
var P_MAP_CHUNKS = "LAST_MAP_CHUNKS"; // عدد أجزاء قائمة آخر تذكير
var P_MAP_CHUNK = "LAST_MAP_"; // بادئة أجزاء القائمة

/* ==========================================================================
 * 2) أدوات مساعدة عامة (خصائص السكربت، الأرقام، النصوص، التواريخ)
 * ========================================================================== */

/** الوصول إلى خصائص السكربت (التوكن والأرقام تُحفظ هنا وليس في الكود) */
function props_() {
  return PropertiesService.getScriptProperties();
}

/** قراءة خاصية نصية (ترجع "" إذا لم توجد) */
function getProp_(key) {
  var v = props_().getProperty(key);
  return v === null || v === undefined ? "" : String(v).trim();
}

/** كتابة خاصية نصية */
function setProp_(key, value) {
  props_().setProperty(key, String(value));
}

/** حذف خاصية (لا يسبب خطأ لو غير موجودة) */
function deleteProp_(key) {
  try {
    props_().deleteProperty(key);
  } catch (err) {
    Logger.log("تعذّر حذف الخاصية " + key + ": " + err);
  }
}

/** قراءة خاصية إلزامية مع رسالة خطأ مفهومة */
function getRequiredProp_(key, label) {
  var v = getProp_(key);
  if (!v) {
    throw new Error(
      "الإعداد «" +
        label +
        "» غير موجود في Script Properties. أضفه من: إعدادات المشروع ← خصائص السكربت (الاسم: " +
        key +
        ")."
    );
  }
  return v;
}

/** توكن البوت */
function token_() {
  return getRequiredProp_(P_TOKEN, "توكن البوت");
}

/** رقم المحادثة الأساسي (أول رقم في القائمة) — تُرسل التذكيرات إليه */
function chatId_() {
  var raw = getRequiredProp_(P_CHAT, "رقم المحادثة");
  return raw.split(/[,،\s]+/)[0];
}

/** كل أرقام المحادثات المسموحة (يمكن وضع أكثر من رقم مفصولاً بفاصلة) */
function allowedChatIds_() {
  var raw = getProp_(P_CHAT);
  if (!raw) return [];
  return raw
    .split(/[,،\s]+/)
    .map(function (s) {
      return String(s).trim();
    })
    .filter(function (s) {
      return s !== "";
    });
}

/** مستخدمو تيليجرام المسموح لهم (اختياري — فارغ = كل من في محادثتي) */
function allowedUserIds_() {
  var raw = getProp_(P_USERS);
  if (!raw) return [];
  return raw
    .split(/[,،\s]+/)
    .map(function (s) {
      return String(s).trim();
    })
    .filter(function (s) {
      return s !== "";
    });
}

/** المنطقة الزمنية للسكربت */
function tz_() {
  var custom = getProp_(P_TIMEZONE);
  if (custom) return custom;
  try {
    return Session.getScriptTimeZone() || "Africa/Nouakchott";
  } catch (err) {
    return "Africa/Nouakchott";
  }
}

/** تحويل الأرقام العربية (١٢٣) والفارسية (۱۲۳) إلى إنجليزية (123) */
function normalizeDigits_(value) {
  var s = String(value === null || value === undefined ? "" : value);
  return s.replace(/[٠-٩۰-۹]/g, function (ch) {
    var code = ch.charCodeAt(0);
    // ٠ = 0x0660 ، ۰ = 0x06F0
    var zero = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String.fromCharCode(48 + (code - zero));
  });
}

/**
 * تنظيف نص عربي قبل تحليل الأوامر:
 * إزالة التشكيل والتطويل ومحارف الاتجاه، وتوحيد الهمزات والتاء المربوطة،
 * وحذف علامات الترقيم وتوحيد المسافات.
 */
function normalizeText_(value) {
  var t = normalizeDigits_(value);
  t = t.replace(/[\u064B-\u065F\u0670\u0640]/g, ""); // تشكيل + تطويل
  t = t.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ""); // محارف اتجاه خفية
  t = t
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه");
  t = t.replace(/[.,،؛;:!؟?"'«»()\[\]]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t.toLowerCase();
}

/** تحويل قيمة خلية إلى رقم (يتقبل "1,500" و"١٥٠٠" و"1500.5") */
function toNum_(value) {
  if (typeof value === "number") return isFinite(value) ? value : null;
  var s = normalizeDigits_(value);
  s = s.replace(/[٬,\s\u00A0]/g, "").replace(/٫/g, "."); // فواصل الآلاف
  s = s.replace(/[^\d.\-]/g, ""); // أي حرف غير رقمي يُحذف
  if (s === "" || s === "-" || s === "." || s === "-.") return null;
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** تحويل قيمة خلية إلى نص نظيف */
function str_(value) {
  if (value === null || value === undefined) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return isNaN(value.getTime()) ? "" : dateKey_(value);
  }
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/** تحويل قيمة خلية إلى تاريخ (يدعم Date، والنصوص، والأرقام المسلسلة) */
function toDate_(value) {
  if (value === null || value === undefined || value === "") return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    // تاريخ مسلسل من جوجل شيتس (1900 = 1)
    var base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + Math.floor(value));
    return isNaN(base.getTime()) ? null : base;
  }
  var s = normalizeDigits_(String(value)).trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); // 2026-11-05
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // 05/11/2026 (يوم/شهر/سنة)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** مفتاح التاريخ "yyyy-MM-dd" (للمقارنة النصية الآمنة من المناطق الزمنية) */
function dateKey_(date) {
  if (!date) return "";
  try {
    return Utilities.formatDate(date, tz_(), "yyyy-MM-dd");
  } catch (err) {
    return "";
  }
}

/** تاريخ اليوم "yyyy-MM-dd" */
function todayKey_() {
  return dateKey_(new Date());
}

/** مفتاح الشهر "yyyy-MM" من تاريخ */
function monthKeyOf_(date) {
  var key = dateKey_(date);
  return key ? key.slice(0, 7) : "";
}

/** تحويل "yyyy-MM-dd" إلى كائن تاريخ */
function parseKey_(key) {
  if (!key) return null;
  var p = String(key).split("-");
  if (p.length < 3) return null;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/** إضافة أيام إلى مفتاح تاريخ وإرجاع مفتاح جديد */
function addDaysKey_(key, days) {
  var d = parseKey_(key);
  if (!d) return "";
  d.setDate(d.getDate() + Number(days || 0));
  return dateKey_(d);
}

/** عدد الأيام بين مفتاحي تاريخ (b - a) */
function daysBetween_(aKey, bKey) {
  var a = parseKey_(aKey);
  var b = parseKey_(bKey);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** تنسيق مبلغ: 1500 ← "1,500 أوقية" */
function formatAmount_(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  var neg = n < 0;
  var abs = Math.abs(n);
  var rounded = Math.round(abs * 100) / 100;
  var parts = String(rounded).split(".");
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  var out = intPart + (parts[1] ? "." + parts[1] : "");
  if (neg) out = "-" + out;
  return CURRENCY ? out + " " + CURRENCY : out;
}

/** مجموع مبالغ قائمة صفوف */
function sumAmounts_(rows) {
  var total = 0;
  (rows || []).forEach(function (r) {
    if (r.amount !== null && !isNaN(r.amount)) total += r.amount;
  });
  return total;
}

/** "2026-11" ← "نوفمبر 2026" */
function monthLabel_(monthKey) {
  if (!monthKey) return "";
  var p = String(monthKey).split("-");
  var idx = Number(p[1]) - 1;
  return (MONTH_NAMES[idx] || monthKey) + " " + p[0];
}

/** إخفاء جزء من نص حساس عند الطباعة في السجل */
function mask_(value) {
  var s = String(value || "");
  if (s.length <= 8) return "***";
  return s.slice(0, 4) + "…" + s.slice(-4) + " (" + s.length + " حرفاً)";
}

/* ==========================================================================
 * 3) الوصول إلى الجدول
 * ========================================================================== */

/**
 * إرجاع الجدول.
 * مهم: في تطبيق الويب لا يوجد «جدول مفتوح»، لذلك نعتمد على المعرّف المحفوظ.
 * شغّل saveSpreadsheetId مرة واحدة من المحرر (والجدول مفتوح).
 */
function getSpreadsheet_() {
  var id = getProp_(P_SHEET);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      throw new Error("تعذّر فتح الجدول بالمعرّف المحفوظ (" + id + "). أعد تشغيل saveSpreadsheetId.");
    }
  }
  var active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    active = null;
  }
  if (active) return active;
  throw new Error(
    "لم أجد الجدول. شغّل الدالة saveSpreadsheetId مرة واحدة من المحرر بينما الجدول مفتوح، " +
      "أو أضف الخاصية SPREADSHEET_ID يدوياً."
  );
}

/** إرجاع ورقة بالاسم مع رسالة خطأ واضحة */
function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error("الورقة «" + name + "» غير موجودة في الجدول.");
  return sheet;
}

/**
 * حفظ معرّف الجدول في Script Properties.
 * شغّلها مرة واحدة من المحرر (تظهر في قائمة الدوال) بينما الجدول مفتوح.
 */
function saveSpreadsheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("افتح الجدول أولاً، ثم من القائمة: الإضافات ← Apps Script ← شغّل الدالة.");
  }
  setProp_(P_SHEET, ss.getId());
  Logger.log("✅ تم حفظ معرّف الجدول: " + ss.getId() + " — الاسم: " + ss.getName());
  return ss.getId();
}

/** هل تعني قيمة الخانة «مدفوع»؟ */
function isPaidValue_(value) {
  if (value === true) return true;
  if (value === false || value === "" || value === null || value === undefined) return false;
  if (typeof value === "number") return value === 1;
  var s = normalizeText_(value);
  return /^(true|yes|y|1|نعم|تم|مدفوع|دفع|✓|✔|صح|مؤشر)$/.test(s);
}

/**
 * وضع علامة «مدفوع» في الخانة، مع مراعاة أنها «خانة اختيار» (Checkbox).
 * بعض الخانات تستخدم قيماً مخصصة (مثل "نعم") فنضع القيمة الصحيحة لها.
 */
function setPaid_(sheet, row, col) {
  var cell = sheet.getRange(row, col);
  var validation = null;
  try {
    validation = cell.getDataValidation();
  } catch (err) {
    validation = null;
  }
  if (validation) {
    var type = "";
    try {
      type = String(validation.getCriteriaType());
    } catch (err) {
      type = "";
    }
    if (type === "CHECKBOX" || type === "checkBox") {
      var values = [];
      try {
        values = validation.getCriteriaValues() || [];
      } catch (err) {
        values = [];
      }
      var checkedValue = true;
      if (values.length && values[0] !== null && values[0] !== undefined && values[0] !== "") {
        checkedValue = values[0];
      }
      cell.setValue(checkedValue);
      return;
    }
  }
  // ليست خانة اختيار: نكتب علامة صح واضحة (يُعتبر أي نص غير فارغ مدفوعاً)
  cell.setValue("✓");
}

/** قراءة صفوف ورقة «المتابعة» */
function readMonthly_(sheet) {
  var rows = [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROWS) return rows;
  var cols = Math.max(M_PAID, sheet.getLastColumn());
  var values = sheet.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, cols).getValues();
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var unitText = str_(v[M_UNIT - 1]);
    var aptText = str_(v[M_APT - 1]);
    var receiptText = str_(v[M_RECEIPT - 1]);
    var due = toDate_(v[M_DUE - 1]);
    if (!unitText && !aptText && !receiptText && !due) continue; // صف فارغ
    var dueKey = dateKey_(due);
    rows.push({
      type: "M",
      sheet: SHEET_MONTHLY,
      paidCol: M_PAID,
      row: HEADER_ROWS + 1 + i,
      unitText: unitText,
      unit: toNum_(unitText),
      aptText: aptText,
      apt: toNum_(aptText),
      receiptText: receiptText,
      receipt: toNum_(receiptText),
      dueRaw: due,
      dueKey: dueKey,
      monthKey: dueKey ? dueKey.slice(0, 7) : "",
      amount: toNum_(v[M_AMOUNT - 1]),
      paid: isPaidValue_(v[M_PAID - 1])
    });
  }
  return rows;
}

/** قراءة صفوف ورقة «السنوية» */
function readAnnual_(sheet) {
  var rows = [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROWS) return rows;
  var cols = Math.max(A_PAID, sheet.getLastColumn());
  var values = sheet.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, cols).getValues();
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var unitText = str_(v[A_UNIT - 1]);
    var due = toDate_(v[A_DUE - 1]);
    if (!unitText && !due) continue;
    var dueKey = dateKey_(due);
    rows.push({
      type: "A",
      sheet: SHEET_ANNUAL,
      paidCol: A_PAID,
      row: HEADER_ROWS + 1 + i,
      unitText: unitText,
      unit: toNum_(unitText),
      aptText: "",
      apt: null,
      receiptText: "",
      receipt: null,
      dueRaw: due,
      dueKey: dueKey,
      monthKey: dueKey ? dueKey.slice(0, 7) : "",
      amount: toNum_(v[A_AMOUNT - 1]),
      paid: isPaidValue_(v[A_PAID - 1])
    });
  }
  return rows;
}

/** قراءة الورقتين معاً */
function readAll_() {
  var ss = getSpreadsheet_();
  var out = { monthly: [], annual: [] };
  var m = ss.getSheetByName(SHEET_MONTHLY);
  if (m) out.monthly = readMonthly_(m);
  var a = ss.getSheetByName(SHEET_ANNUAL);
  if (a) out.annual = readAnnual_(a);
  return out;
}

/**
 * ذاكرة مؤقتة لصفوف الجدول داخل التنفيذ الواحد.
 * الهدف: أمر مثل «دفع 1 2 5 7» لا يقرأ الورقة من جديد لكل رقم.
 * تُبطَل الذاكرة بعد كل تعديل على الجدول (انظر markPaidForRow_).
 */
var __rowsCache = null;

/** إرجاع صفوف الورقتين (من الذاكرة إن وُجدت) */
function rows_() {
  if (!__rowsCache) __rowsCache = readAll_();
  return __rowsCache;
}

/** إبطال الذاكرة المؤقتة (بعد تعديل يدوي أو كتابة في الجدول) */
function invalidateRows_() {
  __rowsCache = null;
}

/** مقارنة رقمين أو نصين (مع تجاهل صيغة الأرقام العربية) */
function sameNum_(a, b) {
  var na = toNum_(a);
  var nb = toNum_(b);
  if (na !== null && nb !== null) return na === nb;
  return normalizeText_(a) === normalizeText_(b);
}

/* ==========================================================================
 * 4) تنسيق نصوص الرسائل
 * ========================================================================== */

/** وصف مختصر لالتزام: «وحدة 2 / شقة 5 / وصل 1» أو «الضريبة السنوية لوحدة 2» */
function labelFor_(r) {
  if (r.type === "A") return "الضريبة السنوية لوحدة " + (r.unitText || "؟");
  return "وحدة " + (r.unitText || "؟") + " / شقة " + (r.aptText || "؟") + " / وصل " + (r.receiptText || "؟");
}

/** سطر تفصيلي كامل لالتزام (يُستخدم في التذكير وقوائم المتأخرات) */
function lineForRow_(r, today) {
  var todayKey = today || todayKey_();
  var parts = [labelFor_(r)];
  if (r.amount !== null) parts.push(formatAmount_(r.amount));
  if (r.dueKey) parts.push("استحقاق " + r.dueKey);
  var line = parts.join(" — ");
  if (r.dueKey && r.dueKey < todayKey) {
    line += " (متأخر " + daysBetween_(r.dueKey, todayKey) + " يوماً)";
  }
  return line;
}

/** تحويل التزام إلى عنصر مختصر يُحفظ في خريطة آخر تذكير */
function toItem_(r) {
  return [
    r.type,
    r.row,
    r.unitText || "",
    r.aptText || "",
    r.receiptText || "",
    r.amount === null ? "" : r.amount,
    r.dueKey || ""
  ];
}

/** نص مساعدة الأوامر */
function helpText_() {
  return [
    "🤖 أوامر بوت تذكير الضرائب",
    "",
    "🔸 دفع 1",
    "تسجيل الالتزام رقم 1 من آخر تذكير.",
    "",
    "🔸 دفع 1 2 5",
    "تسجيل عدة أرقام من آخر تذكير.",
    "",
    "🔸 دفع 2 5 1",
    "تسجيل التزام الشهر الحالي بالتفصيل: وحدة / شقة / وصل.",
    "  (إن لم يوجد التزام مطابق، تُفسَّر كأرقام من آخر تذكير)",
    "",
    "🔸 دفع أرقام 1 2 5",
    "لإجبار التفسير كأرقام من آخر تذكير بلا لبس.",
    "",
    "🔸 سنوي 2",
    "تسجيل الضريبة السنوية للوحدة 2.",
    "  (اختياري: سنوي 2 2026 لتحديد السنة)",
    "",
    "🔸 متأخر",
    "عرض المتأخرات الحالية.",
    "",
    "🔸 ملخص",
    "عدد المدفوع وغير المدفوع هذا الشهر.",
    "",
    "🔸 مساعدة",
    "عرض هذه القائمة.",
    "",
    "💡 يقبل البوت الأرقام العربية (١٢٣) و«دفعت / دفعه / ادفع»."
  ].join("\n");
}

/* ==========================================================================
 * 5) تحليل الأوامر
 * ========================================================================== */

/**
 * تحديد نوع الأمر من أول كلمة.
 * متسامح مع: /دفع ، الدفع ، ادفع ، دفعت ، دفعه ، ودعت (خطأ إملائي شائع) …
 */
function detectCommand_(word) {
  var w = normalizeText_(word || "");
  w = w.replace(/^[\/#!.\-–]+/, ""); // شرطة مائلة أو رموز قبل الأمر
  w = w.replace(/^و/, ""); // «ودفع»
  w = w.replace(/^ال/, ""); // «الدفع»
  if (!w) return "";

  // دفع / دفعتها / دفعت / دفعه / ادفع / ادفعو / سدد / سددت / دفعو / دفعنا
  if (/^(ا?دفع|داف?ع|سدد|سداد|تدفع|دفعو|دفعنا)/.test(w)) return "PAY";
  if (/^(سنوي|سنويه|سنويات|annual)/.test(w)) return "ANNUAL";
  if (/^(متاخر|متاخرات|تاخير|late|overdue)/.test(w)) return "LATE";
  if (/^(ملخص|ملخصي|احصائيات|احصاء|تقرير|summary|status)/.test(w)) return "SUMMARY";
  if (/^(مساعده|مساعد|اوامر|help|start|بدايه|مرحبا|السلام|هلا)/.test(w)) return "HELP";
  return "";
}

/** استخراج كل الأرقام من النص بالترتيب */
function extractNumbers_(text) {
  var matches = String(text || "").match(/\d+(?:\.\d+)?/g) || [];
  var out = [];
  for (var i = 0; i < matches.length; i++) {
    var n = parseInt(matches[i], 10);
    if (!isNaN(n)) out.push(n);
  }
  return out;
}

/** تحليل النص إلى { command, numbers, forceIndexes } */
function parseCommand_(rawText) {
  var text = String(rawText === null || rawText === undefined ? "" : rawText);
  // إزالة منشن البوت مثل /دفع@MyTaxBot حتى لا تدخل أرقام اليوزرنيم في التحليل
  var clean = text.replace(/@[A-Za-z0-9_]+/g, " ");
  var normalized = normalizeText_(clean);
  var firstWord = normalized.split(" ")[0] || "";
  return {
    command: detectCommand_(firstWord),
    numbers: extractNumbers_(normalizeDigits_(clean)),
    forceIndexes: /(^|\s)ارقام(\s|$)/.test(normalized),
    text: text
  };
}

/**
 * تنفيذ الأمر وإرجاع نص الرد (لا يرسل شيئاً — الإرسال مسؤولية doPost/المستدعي).
 */
function handleCommand_(rawText) {
  invalidateRows_(); // نبدأ دائماً بقراءة حديثة من الجدول
  var parsed = parseCommand_(rawText);
  switch (parsed.command) {
    case "PAY":
      return doPay_(parsed.numbers, parsed.forceIndexes);
    case "ANNUAL":
      return doAnnual_(parsed.numbers);
    case "LATE":
      return doLate_();
    case "SUMMARY":
      return doSummary_();
    case "HELP":
      return helpText_();
    default:
      return (
        "لم أفهم الأمر 🤔\n" +
        (parsed.numbers.length
          ? "إن كنت تقصد تسجيل دفع اكتب: دفع " + parsed.numbers.join(" ") + "\n\n"
          : "اكتب «مساعدة» لعرض الأوامر.\n\n") +
        helpText_()
      );
  }
}

/* ==========================================================================
 * 6) أمر «دفع»
 * ========================================================================== */

/** توجيه أمر الدفع حسب عدد الأرقام */
function doPay_(numbers, forceIndexes) {
  var nums = numbers || [];
  if (!nums.length) {
    return [
      "⚠️ لم أجد أرقاماً بعد كلمة «دفع».",
      "",
      "• دفع 1 ← الالتزام رقم 1 من آخر تذكير.",
      "• دفع 2 5 1 ← وحدة 2 / شقة 5 / وصل 1.",
      "• دفع 1 2 5 ← عدة أرقام من آخر تذكير."
    ].join("\n");
  }

  // ثلاثة أرقام: نحاول (وحدة/شقة/وصل) أولاً، وإن لم يوجد صف مطابق نعتبرها أرقاماً
  if (nums.length === 3 && !forceIndexes) {
    if (findMonthlyMatch_(nums[0], nums[1], nums[2])) {
      return payByTriple_(nums[0], nums[1], nums[2]);
    }
    var mapForTriple = getReminderMap_();
    var maxIdx = mapForTriple.items.length;
    var allAreIndexes =
      maxIdx > 0 &&
      nums.every(function (n) {
        return n >= 1 && n <= maxIdx;
      });
    if (allAreIndexes) return payByIndex_(nums);
    return [
      "⚠️ لم أجد التزاماً بالوحدة " + nums[0] + " / الشقة " + nums[1] + " / الوصل " + nums[2] + " في ورقة «" + SHEET_MONTHLY + "».",
      "",
      maxIdx > 0
        ? "وهذه الأرقام ليست كلها ضمن أرقام آخر تذكير (عددها " + maxIdx + ")."
        : "ولا يوجد تذكير محفوظ بعد لاستخدام الأرقام.",
      "",
      "تأكد من الأرقام كما هي في الجدول، أو أرسل: «متأخر» لعرض الالتزامات."
    ].join("\n");
  }

  // رقمان: أرقام تذكير إن كانت داخل النطاق، وإلا (وحدة/شقة)
  if (nums.length === 2 && !forceIndexes) {
    var map = getReminderMap_();
    var maxIndex = map.items.length;
    var bothInRange =
      nums[0] >= 1 && nums[0] <= maxIndex && nums[1] >= 1 && nums[1] <= maxIndex && maxIndex > 0;
    if (bothInRange) return payByIndex_(nums);
    var byApt = findMonthlyMatch_(nums[0], nums[1], null);
    if (byApt) return payByUnitApt_(nums[0], nums[1]);
    return payByIndex_(nums);
  }

  return payByIndex_(nums);
}

/** تسجيل دفع التزامات بأرقامها من آخر تذكير */
function payByIndex_(indexes) {
  var map = getReminderMap_();
  if (!map.items.length) {
    return [
      "⚠️ لا يوجد تذكير محفوظ بعد.",
      "",
      "شغّل الدالة sendMonthlyReminder (أو sendTestReminder) من محرر Apps Script،",
      "وبعد وصول التذكير إلى تيليجرام استخدم: دفع 1",
      "",
      "ويمكنك دائماً التسجيل بالتفصيل: دفع 2 5 1 (وحدة / شقة / وصل)."
    ].join("\n");
  }

  var done = [];
  var already = [];
  var failed = [];
  for (var i = 0; i < indexes.length; i++) {
    var n = indexes[i];
    if (n < 1 || n > map.items.length) {
      failed.push("الرقم " + n + " غير موجود (آخر تذكير فيه " + map.items.length + " التزاماً)");
      continue;
    }
    var res = markItemPaid_(map.items[n - 1]);
    var line = n + ") " + res.message;
    if (res.ok && res.already) already.push(line);
    else if (res.ok) done.push(line);
    else failed.push(line);
  }

  var parts = [];
  if (done.length) {
    parts.push(
      (done.length === 1 ? "✅ تم تسجيل الدفع:\n" : "✅ تم تسجيل " + done.length + " مدفوعات:\n") + done.join("\n")
    );
  }
  if (already.length) parts.push("ℹ️ مسجّل مدفوعاً مسبقاً:\n" + already.join("\n"));
  if (failed.length) parts.push("⚠️ لم أستطع:\n" + failed.join("\n"));
  return parts.join("\n\n");
}

/** البحث عن التزام شهري مطابق (وحدة، شقة، وصل) — مرّر null للبحث الجزئي */
function findMonthlyMatch_(unit, apt, receipt) {
  var all = rows_();
  var candidates = all.monthly.filter(function (r) {
    if (!sameNum_(r.unitText, unit)) return false;
    if (apt !== null && apt !== undefined && !sameNum_(r.aptText, apt)) return false;
    if (receipt !== null && receipt !== undefined && !sameNum_(r.receiptText, receipt)) return false;
    return true;
  });
  if (!candidates.length) return null;
  var month = todayKey_().slice(0, 7);
  var sameMonth = candidates.filter(function (r) {
    return r.monthKey === month;
  });
  var pool = sameMonth.length ? sameMonth : candidates;
  var unpaid = pool.filter(function (r) {
    return !r.paid;
  });
  return unpaid.length ? unpaid[0] : pool[pool.length - 1];
}

/** تسجيل دفع بالتفصيل: وحدة / شقة / وصل */
function payByTriple_(unit, apt, receipt) {
  var target = findMonthlyMatch_(unit, apt, receipt);
  if (!target) {
    return [
      "⚠️ لم أجد التزاماً بالوحدة " + unit + " / الشقة " + apt + " / الوصل " + receipt + ".",
      "",
      "تأكد من الأرقام كما هي في ورقة «" + SHEET_MONTHLY + "»،",
      "أو استخدم رقم الالتزام من آخر تذكير: دفع 1"
    ].join("\n");
  }
  var res = markPaidForRow_(target);
  if (!res.ok) return "⚠️ " + res.message;
  if (res.already) {
    return "ℹ️ " + res.message + "\n\nإن كان لديك وصل آخر لنفس الشقة، أرسل رقمه: دفع " + unit + " " + apt + " <رقم الوصل>";
  }
  return [
    "✅ تم تسجيل دفع وحدة " + unit + " / شقة " + apt + " / وصل " + receipt,
    "• المبلغ: " + (formatAmount_(target.amount) || "غير محدد"),
    "• الاستحقاق: " + (target.dueKey || "غير محدد"),
    "• علامة ✓ وُضعت في ورقة «" + SHEET_MONTHLY + "» أمام الصف " + target.row
  ].join("\n");
}

/** تسجيل دفع الشهر الحالي لوحدة وشقة (بلا رقم وصل) */
function payByUnitApt_(unit, apt) {
  var target = findMonthlyMatch_(unit, apt, null);
  if (!target) {
    return "⚠️ لم أجد التزاماً للوحدة " + unit + " / الشقة " + apt + ".\nجرّب: دفع " + unit + " " + apt + " <رقم الوصل>";
  }
  var res = markPaidForRow_(target);
  if (!res.ok) return "⚠️ " + res.message;
  if (res.already) return "ℹ️ " + res.message;
  return [
    "✅ تم تسجيل دفع " + labelFor_(target),
    "• المبلغ: " + (formatAmount_(target.amount) || "غير محدد"),
    "• الاستحقاق: " + (target.dueKey || "غير محدد")
  ].join("\n");
}

/** تسجيل الدفع لصف مُقروء من الجدول */
function markPaidForRow_(r) {
  if (r.paid) {
    return {
      ok: true,
      already: true,
      message: labelFor_(r) + " — مسجّل مدفوعاً مسبقاً ✅" + (r.dueKey ? " (استحقاق " + r.dueKey + ")" : "")
    };
  }
  setPaid_(getSheet_(r.sheet), r.row, r.paidCol);
  r.paid = true; // تحديث الذاكرة المؤقتة حتى لا يُسجَّل نفس الصف مرتين في الأمر الواحد
  return {
    ok: true,
    already: false,
    message:
      labelFor_(r) +
      " — " +
      (formatAmount_(r.amount) || "بلا مبلغ") +
      (r.dueKey ? " (استحقاق " + r.dueKey + ")" : "")
  };
}

/**
 * تسجيل عنصر محفوظ من آخر تذكير (رقمه في الخريطة).
 * نتحقق أولاً من أن الصف ما زال لنفس الالتزام، وإلا نبحث عنه بالوحدة/الشقة/الوصل.
 */
function markItemPaid_(item) {
  if (!item || !item.length) return { ok: false, already: false, message: "عنصر غير صالح في آخر تذكير" };
  var type = item[0] === "A" ? "A" : "M";
  var row = Number(item[1]) || 0;
  var unitText = item[2];
  var aptText = item[3];
  var receiptText = item[4];

  var all = rows_();
  var list = type === "A" ? all.annual : all.monthly;

  if (!list.length) {
    return {
      ok: false,
      already: false,
      message: "الورقة «" + (type === "A" ? SHEET_ANNUAL : SHEET_MONTHLY) + "» فارغة أو غير موجودة"
    };
  }

  var target = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].row === row) {
      target = list[i];
      break;
    }
  }
  var identityOk =
    target &&
    sameNum_(target.unitText, unitText) &&
    (type === "A" || (sameNum_(target.aptText, aptText) && sameNum_(target.receiptText, receiptText)));

  if (!target || !identityOk) {
    // تغيّر ترتيب الصفوف: نبحث بالوحدة/الشقة/الوصل
    var found = list.filter(function (r) {
      if (!sameNum_(r.unitText, unitText)) return false;
      if (type === "A") return true;
      return sameNum_(r.aptText, aptText) && sameNum_(r.receiptText, receiptText);
    });
    var unpaid = found.filter(function (r) {
      return !r.paid;
    });
    target = unpaid.length ? unpaid[0] : found.length ? found[found.length - 1] : null;
  }

  if (!target) {
    return {
      ok: false,
      already: false,
      message: "لم أجد الالتزام في الجدول (ربما حُذف). أعد إرسال التذكير ثم استخدم الأرقام الجديدة."
    };
  }
  return markPaidForRow_(target);
}

/* ==========================================================================
 * 7) أمر «سنوي»
 * ========================================================================== */

function doAnnual_(numbers) {
  var nums = numbers || [];
  if (!nums.length) return "🗓️ اكتب رقم الوحدة بعد الأمر. مثال: سنوي 2";
  var unit = nums[0];
  var year = nums.length > 1 ? String(nums[1]) : "";

  var all = rows_();
  var items = all.annual.filter(function (r) {
    return sameNum_(r.unitText, unit);
  });
  if (!items.length) {
    return "⚠️ لا توجد ضريبة سنوية مسجّلة للوحدة " + unit + " في ورقة «" + SHEET_ANNUAL + "».";
  }
  if (year) {
    items = items.filter(function (r) {
      return r.dueKey && r.dueKey.slice(0, 4) === year;
    });
    if (!items.length) return "⚠️ لا توجد ضريبة سنوية للوحدة " + unit + " في سنة " + year + ".";
  }

  items.sort(function (a, b) {
    return String(a.dueKey).localeCompare(String(b.dueKey));
  });
  var unpaid = items.filter(function (r) {
    return !r.paid;
  });
  if (!unpaid.length) {
    return (
      "ℹ️ الضريبة السنوية للوحدة " +
      unit +
      " مسجّلة مدفوعاً مسبقاً ✅" +
      (items.length ? " (استحقاق " + items[items.length - 1].dueKey + ")" : "")
    );
  }

  var target = unpaid[0];
  var res = markPaidForRow_(target);
  if (!res.ok) return "⚠️ " + res.message;
  var rest = unpaid.length - 1;
  return [
    "✅ تم تسجيل الضريبة السنوية لوحدة " + unit,
    "• المبلغ: " + (formatAmount_(target.amount) || "غير محدد"),
    "• الاستحقاق: " + (target.dueKey || "غير محدد"),
    "• علامة ✓ وُضعت في ورقة «" + SHEET_ANNUAL + "» أمام الصف " + target.row,
    rest > 0 ? "ℹ️ ما زالت هناك " + rest + " ضريبة سنوية غير مدفوعة لنفس الوحدة." : ""
  ]
    .filter(function (s) {
      return s !== "";
    })
    .join("\n");
}

/* ==========================================================================
 * 8) أمرا «متأخر» و«ملخص»
 * ========================================================================== */

function doLate_() {
  var all = rows_();
  var today = todayKey_();
  var late = [];

  all.monthly.forEach(function (r) {
    if (!r.paid && r.dueKey && r.dueKey < today) late.push(r);
  });
  all.annual.forEach(function (r) {
    if (!r.paid && r.dueKey && r.dueKey < today) late.push(r);
  });

  if (!late.length) {
    return "✅ لا توجد متأخرات حتى " + today + ".\nكل المستحقات السابقة مسجّلة مدفوعة.";
  }

  late.sort(function (a, b) {
    return String(a.dueKey).localeCompare(String(b.dueKey));
  });

  var lines = ["⏰ المتأخرات الحالية حتى " + today + " (عدد: " + late.length + ")", ""];
  late.forEach(function (r) {
    lines.push("• " + lineForRow_(r, today));
  });
  lines.push("");
  lines.push("💰 إجمالي المتأخرات: " + formatAmount_(sumAmounts_(late)));
  lines.push("");
  lines.push("للتسجيل: «دفع 2 5 1» (وحدة / شقة / وصل) أو «دفع 1» من آخر تذكير.");
  return lines.join("\n");
}

function doSummary_() {
  var all = rows_();
  var today = todayKey_();
  var month = today.slice(0, 7);
  var year = today.slice(0, 4);

  var monthRows = all.monthly.filter(function (r) {
    return r.monthKey === month;
  });
  var paidM = monthRows.filter(function (r) {
    return r.paid;
  });
  var unpaidM = monthRows.filter(function (r) {
    return !r.paid;
  });
  var noDate = all.monthly.filter(function (r) {
    return !r.dueKey;
  });
  var lateM = all.monthly
    .concat(all.annual)
    .filter(function (r) {
      return !r.paid && r.dueKey && r.dueKey < today;
    });

  var yearAnnual = all.annual.filter(function (r) {
    return r.dueKey && r.dueKey.slice(0, 4) === year;
  });
  var paidA = yearAnnual.filter(function (r) {
    return r.paid;
  });
  var unpaidA = yearAnnual.filter(function (r) {
    return !r.paid;
  });

  var totalM = paidM.length + unpaidM.length;
  var rate = totalM ? Math.round((paidM.length / totalM) * 100) : 0;

  var lines = [
    "📊 ملخص " + monthLabel_(month),
    "",
    "— الاشتراكات الشهرية (ورقة «" + SHEET_MONTHLY + "») —",
    "✅ مدفوع: " + paidM.length + " — " + (formatAmount_(sumAmounts_(paidM)) || "0"),
    "⏳ غير مدفوع: " + unpaidM.length + " — " + (formatAmount_(sumAmounts_(unpaidM)) || "0"),
    "📈 نسبة التحصيل: " + rate + "%",
    "⏰ متأخر عن تاريخ اليوم: " + lateM.length,
    "",
    "— الضريبة السنوية (سنة " + year + ") —",
    "✅ مدفوع: " + paidA.length + " — " + (formatAmount_(sumAmounts_(paidA)) || "0"),
    "⏳ غير مدفوع: " + unpaidA.length + " — " + (formatAmount_(sumAmounts_(unpaidA)) || "0")
  ];

  if (noDate.length) {
    lines.push("");
    lines.push("ℹ️ ملاحظة: " + noDate.length + " صفاً في «" + SHEET_MONTHLY + "» بلا تاريخ استحقاق صالح (لن تُحسب).");
  }
  return lines.join("\n");
}

/* ==========================================================================
 * 9) الإرسال إلى تيليجرام
 * ========================================================================== */

/** عنوان واجهة تيليجرام لأي دالة */
function apiUrl_(method) {
  return "https://api.telegram.org/bot" + token_() + "/" + method;
}

/**
 * تقسيم نص طويل إلى أجزاء لا تتجاوز الحد، مع محاولة عدم قطع الأسطر.
 */
function splitMessage_(text, limit) {
  var s = String(text === null || text === undefined ? "" : text);
  var max = limit || MAX_MESSAGE_LENGTH;
  if (s.length <= max) return [s];

  var chunks = [];
  var current = "";
  var lines = s.split("\n");

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // سطر أطول من الحد: نقطعه قطعاً صغيرة
    while (line.length > max) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(line.slice(0, max));
      line = line.slice(max);
    }

    var candidate = current ? current + "\n" + line : line;
    if (candidate.length > max) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * ✅ الدالة الرئيسية للإرسال.
 *
 * sendTelegram("نص الرسالة")                          ← إرسال نص فقط
 * sendTelegram("نص الرسالة", items)                   ← إرسال + حفظ خريطة الأرقام
 * sendTelegram("نص", items, "123456")                 ← إلى محادثة محددة
 *
 * - ترسل عبر UrlFetchApp إلى sendMessage.
 * - تقسم ما يتجاوز 4000 حرف.
 * - تحفظ في Script Properties قائمة مرقّمة تربط كل رقم في آخر تذكير
 *   بالتزامه (نوعه + رقم الصف + ورقته + وحدته/شقته/وصله + مبلغه + استحقاقه).
 * - تعالج الأخطاء بـ try/catch وتسجل الفشل في Logger.
 *
 * @return {boolean} نجاح الإرسال
 */
function sendTelegram(text, items, chatIdOverride) {
  var sent = false;
  try {
    var chatId = String(chatIdOverride || chatId_()).trim();
    if (!chatId) throw new Error("رقم المحادثة فارغ");

    var chunks = splitMessage_(text, MAX_MESSAGE_LENGTH);
    var successCount = 0;

    for (var i = 0; i < chunks.length; i++) {
      var payload = {
        chat_id: chatId,
        text: chunks[i],
        disable_web_page_preview: true
      };
      var response = UrlFetchApp.fetch(apiUrl_("sendMessage"), {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      var code = response.getResponseCode();
      var body = response.getContentText();
      var parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        parsed = {};
      }
      if (code === 200 && parsed && parsed.ok === true) {
        successCount++;
      } else {
        Logger.log(
          "❌ فشل إرسال الجزء " + (i + 1) + "/" + chunks.length + " (رمز " + code + "): " + body
        );
      }
      // لطفاً بحدود تيليجرام (30 رسالة/ثانية) عند التقسيم
      if (i < chunks.length - 1) Utilities.sleep(350);
    }

    Logger.log("📤 تيليجرام: أُرسل " + successCount + "/" + chunks.length + " جزءاً إلى " + chatId);

    if (successCount === chunks.length) {
      sent = true;
      // لا نحفظ الخريطة إلا إذا وصل التذكير كاملاً، حتى تتطابق الأرقام مع ما رآه المستخدم
      if (items && items.length) saveReminderMap_(items);
    }
  } catch (err) {
    Logger.log("❌ فشل إرسال رسالة تيليجرام: " + err + "\n" + (err && err.stack ? err.stack : ""));
    sent = false;
  }
  return sent;
}

/** استدعاء أي دالة في تيليجرام (تُستخدم للويب هوك والاستعلامات) */
function telegramFetch_(method, payload) {
  var response = UrlFetchApp.fetch(apiUrl_(method), {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  var raw = response.getContentText();
  var data = {};
  try {
    data = JSON.parse(raw);
  } catch (err) {
    data = {};
  }
  return {
    code: response.getResponseCode(),
    ok: !!(data && data.ok),
    data: data,
    raw: raw
  };
}

/* ==========================================================================
 * 10) خريطة آخر تذكير (ترقيم ← التزام)
 * ========================================================================== */

/** تقسيم نص طويل إلى أجزاء بعدد أحرف محدد (تُحفظ كل قطعة في خاصية مستقلة) */
function splitString_(text, size) {
  var s = String(text || "");
  var out = [];
  for (var i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [""];
}

/** حذف أجزاء الخريطة السابقة */
function clearReminderMap_() {
  var keys = [];
  try {
    keys = props_().getKeys() || [];
  } catch (err) {
    keys = [];
  }
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === P_MAP_META || k === P_MAP_CHUNKS || k.indexOf(P_MAP_CHUNK) === 0) deleteProp_(k);
  }
}

/**
 * حفظ قائمة العناصر المرقّمة.
 * ملاحظة: حجم الخاصية الواحدة محدود (~9 كيلوبايت)، لذلك نقسّم JSON على عدة خصائص.
 */
function saveReminderMap_(items) {
  var json = JSON.stringify(items || []);
  // 1500 حرفاً لكل جزء آمن حتى مع النصوص العربية (قد يصل الحرف إلى 3 بايت)
  var chunks = splitString_(json, 1500);
  clearReminderMap_();
  for (var i = 0; i < chunks.length; i++) setProp_(P_MAP_CHUNK + i, chunks[i]);
  setProp_(P_MAP_CHUNKS, chunks.length);
  setProp_(
    P_MAP_META,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      month: todayKey_().slice(0, 7),
      count: (items || []).length
    })
  );
  Logger.log("💾 حُفظت خريطة آخر تذكير: " + (items || []).length + " التزاماً في " + chunks.length + " جزءاً.");
}

/** قراءة خريطة آخر تذكير: { items: [...], meta: {...} } */
function getReminderMap_() {
  var count = parseInt(getProp_(P_MAP_CHUNKS) || "0", 10) || 0;
  var json = "";
  for (var i = 0; i < count; i++) json += getProp_(P_MAP_CHUNK + i);
  if (!json) return { items: [], meta: null };

  var items = [];
  var meta = null;
  try {
    items = JSON.parse(json) || [];
  } catch (err) {
    Logger.log("❌ تعذّر قراءة خريطة آخر تذكير: " + err);
    items = [];
  }
  try {
    var metaRaw = getProp_(P_MAP_META);
    meta = metaRaw ? JSON.parse(metaRaw) : null;
  } catch (err) {
    meta = null;
  }
  return { items: items, meta: meta };
}

/* ==========================================================================
 * 11) بناء التذكير وإرساله
 * ========================================================================== */

/**
 * بناء رسالة التذكير وإرسالها.
 * الترتيب: المتأخرات ← مستحقات هذا الشهر ← الضريبة السنوية خلال 30 يوماً.
 * الترقيم متصل عبر الأقسام، وهو نفس الترقيم الذي يفهمه الأمر «دفع».
 */
function buildAndSendReminder_(testMode) {
  invalidateRows_();
  var all = rows_();
  var today = todayKey_();
  var month = today.slice(0, 7);
  var horizon = addDaysKey_(today, 30);

  var overdue = [];
  var dueThisMonth = [];
  var annualSoon = [];

  all.monthly.forEach(function (r) {
    if (r.paid || !r.dueKey) return;
    if (r.dueKey < today) overdue.push(r);
    else if (r.monthKey === month) dueThisMonth.push(r);
  });
  all.annual.forEach(function (r) {
    if (r.paid || !r.dueKey) return;
    if (r.dueKey < today) overdue.push(r);
    else if (r.dueKey <= horizon) annualSoon.push(r);
  });

  var sortByDue = function (a, b) {
    return String(a.dueKey).localeCompare(String(b.dueKey));
  };
  overdue.sort(sortByDue);
  dueThisMonth.sort(sortByDue);
  annualSoon.sort(sortByDue);

  if (testMode) {
    overdue = overdue.slice(0, 2);
    dueThisMonth = dueThisMonth.slice(0, 2);
    annualSoon = annualSoon.slice(0, 1);
  }

  var items = [];
  var lines = [];
  lines.push((testMode ? "🧪 تذكير تجريبي — " : "🔔 تذكير المستحقات — ") + monthLabel_(month));
  lines.push("📅 اليوم: " + today);
  lines.push("");

  var addSection = function (title, rows) {
    if (!rows.length) return;
    lines.push(title + " (" + rows.length + "):");
    rows.forEach(function (r) {
      items.push(toItem_(r));
      lines.push(items.length + ") " + lineForRow_(r, today));
    });
    lines.push("");
  };

  addSection("⏰ متأخرات", overdue);
  addSection("📌 مستحقات هذا الشهر", dueThisMonth);
  addSection("🏛️ الضريبة السنوية (خلال 30 يوماً)", annualSoon);

  if (!items.length) {
    var emptyText =
      "🎉 لا توجد مستحقات غير مدفوعة حالياً.\n📅 " + today + "\n\nكل الالتزامات في ورقتَي «" +
      SHEET_MONTHLY +
      "» و«" +
      SHEET_ANNUAL +
      "» مسجّلة مدفوعة.";
    sendTelegram(emptyText);
    Logger.log("لا توجد مستحقات — أُرسلت رسالة «لا يوجد».");
    return emptyText;
  }

  lines.push("💰 الإجمالي: " + formatAmount_(sumAmounts_(items.map(rowFromItem_))));
  lines.push("");
  lines.push("🔹 للتسجيل بالأرقام: «دفع 1» أو «دفع 1 3 5»");
  lines.push("🔹 أو بالتفصيل: «دفع 2 5 1» (وحدة / شقة / وصل)");
  lines.push("❓ «مساعدة» لعرض كل الأوامر");

  var text = lines.join("\n");
  var ok = sendTelegram(text, items);
  Logger.log(ok ? "✅ أُرسل التذكير (" + items.length + " التزاماً)." : "❌ فشل إرسال التذكير (راجع السجل).");
  return text;
}

/** تحويل عنصر خريطة إلى صف مبسّط (لحساب الإجمالي) */
function rowFromItem_(item) {
  return { amount: item[5] === "" || item[5] === null ? null : Number(item[5]) };
}

/** إرسال تذكير الشهر الحالي (ترسلها أنت، أو من مشغّل زمني) */
function sendMonthlyReminder() {
  return buildAndSendReminder_(false);
}

/** تذكير تجريبي: نفس المنطق لكن بعدد محدود من الالتزامات وترويسة «تجريبي» */
function sendTestReminder() {
  return buildAndSendReminder_(true);
}

/* ==========================================================================
 * 12) استقبال أوامر تيليجرام (doPost / الويب هوك)
 * ========================================================================== */

/** رد بسيط لتيليجرام (200 دائماً حتى لا يعيد الإرسال) */
function textResponse_(message) {
  return ContentService.createTextOutput(String(message || "ok")).setMimeType(ContentService.MimeType.TEXT);
}

/** هل المحادثة مسموحة؟ */
function isAllowedChat_(chatId) {
  var allowed = allowedChatIds_();
  if (!allowed.length) return false;
  return allowed.indexOf(String(chatId).trim()) !== -1;
}

/** هل المستخدم مسموح (إن كانت الخاصية مضبوطة)؟ */
function isAllowedUser_(userId) {
  var allowed = allowedUserIds_();
  if (!allowed.length) return true;
  if (userId === null || userId === undefined) return false;
  return allowed.indexOf(String(userId).trim()) !== -1;
}

/**
 * منع معالجة نفس التحديث مرتين.
 * تيليجرام يعيد إرسال التحديث إذا تأخر ردنا، فنحتفظ بآخر 60 معرّفاً.
 * @return {boolean} true إذا كان التحديث جديداً وعلينا معالجته
 */
function claimUpdate_(updateId) {
  if (updateId === null || updateId === undefined || updateId === "") return true;
  var idStr = String(updateId);
  var lock = null;
  var locked = false;
  try {
    lock = LockService.getScriptLock();
    locked = lock.tryLock(15000);
  } catch (err) {
    locked = false;
  }
  try {
    var seen = [];
    try {
      seen = JSON.parse(getProp_(P_SEEN) || "[]") || [];
    } catch (err) {
      seen = [];
    }
    if (seen.indexOf(idStr) !== -1) return false;
    seen.push(idStr);
    if (seen.length > 60) seen = seen.slice(seen.length - 60);
    setProp_(P_SEEN, JSON.stringify(seen));
    return true;
  } finally {
    if (locked && lock) {
      try {
        lock.releaseLock();
      } catch (err) {
        // تجاهل
      }
    }
  }
}

/**
 * ⚡ نقطة الدخول من تيليجرام.
 * - تقرأ التحديث من e.postData.contents.
 * - تتجاهل أي رسالة ليست من رقم محادثتي (أمان)، وترد على الغريب برقم محادثته
 *   لمساعدتك في الإعداد الأولي (لا تُنفّذ أوامره أبداً).
 * - تمنع التكرار عبر update_id.
 * - ترد بسرعة ودائماً بطلب ناجح، وتتعامل مع الرسائل غير النصية بلطف.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return textResponse_("ok");

    var update;
    try {
      update = JSON.parse(e.postData.contents);
    } catch (err) {
      Logger.log("❌ محتوى غير صالح في doPost: " + e.postData.contents);
      return textResponse_("bad request");
    }

    // تحقق اختياري من السر (إن كانت الخاصية WEBHOOK_SECRET مضبوطة)
    var secret = getProp_(P_SECRET);
    if (secret) {
      var headers = e.headers || {};
      var received =
        headers["X-Telegram-Bot-Api-Secret-Token"] || headers["x-telegram-bot-api-secret-token"] || "";
      if (String(received) !== secret) {
        Logger.log("⛔ رُفض تحديث لأن سر الويب هوك غير مطابق.");
        return textResponse_("forbidden");
      }
    }

    var msg =
      update.message ||
      update.edited_message ||
      update.channel_post ||
      (update.callback_query && update.callback_query.message) ||
      null;
    if (!msg) return textResponse_("ok");

    var chat = msg.chat || {};
    var chatId = chat.id;
    var fromId = msg.from ? msg.from.id : null;

    // 🔒 الأمان: تجاهل كل ما ليس من محادثتي
    var chatOk = isAllowedChat_(chatId);
    var userOk = isAllowedUser_(fromId);
    if (!chatOk || !userOk) {
      Logger.log(
        "⛔ رسالة مرفوضة — chat_id=" +
          chatId +
          " النوع=" +
          (chat.type || "?") +
          " العنوان=" +
          (chat.title || chat.username || "") +
          " من=" +
          (msg.from ? msg.from.first_name + " (id=" + fromId + ")" : "?") +
          " السبب=" +
          (!chatOk ? "المحادثة غير مسموحة" : "المستخدم غير مسموح")
      );
      var hintEnabled = normalizeText_(getProp_(P_HINT)) !== "لا";
      if (!chatOk && hintEnabled) {
        // فائدة إعدادية: نُعلمه برقم محادثته فقط (بدون تنفيذ أي أمر)
        // لإيقاف هذا التنبيه: أضف الخاصية SEND_CHAT_ID_HINT = لا
        sendTelegram(
          "⛔ هذه المحادثة غير مصرّح لها باستخدام البوت.\n" +
            "رقم هذه المحادثة هو: " +
            chatId +
            "\nأضِفه إلى الخاصية TELEGRAM_CHAT_ID في خصائص السكربت.",
          null,
          chatId
        );
      } else if (!userOk && hintEnabled) {
        sendTelegram(
          "⛔ حسابك غير مسموح باستخدام البوت.\n" +
            "رقم حسابك: " +
            fromId +
            "\nأضِفه إلى الخاصية TELEGRAM_ALLOWED_USER_IDS إن كان يجب أن يعمل.",
          null,
          chatId
        );
      }
      return textResponse_("ignored");
    }

    // 🔁 منع معالجة نفس التحديث مرتين (تيليجرام يعيد الإرسال إن تأخر ردنا)
    if (!claimUpdate_(update.update_id)) {
      Logger.log("🔁 تحديث مكرر تم تجاهله: " + update.update_id);
      return textResponse_("duplicate");
    }

    var text = msg.text || msg.caption || "";
    if (!text) {
      // رسالة غير نصية (صورة/ملصق/صوت…): نرد بسرعة ولا نتعطل
      sendTelegram("🤖 أستقبل الأوامر النصية فقط.\nاكتب «مساعدة» لعرض قائمة الأوامر.", null, chatId);
      return textResponse_("ok");
    }

    var reply = handleCommand_(text);
    if (reply) sendTelegram(reply, null, chatId);
    return textResponse_("ok");
  } catch (err) {
    Logger.log("❌ خطأ في doPost: " + err + "\n" + (err && err.stack ? err.stack : ""));
    // نرد 200 دائماً حتى لا يعيد تيليجرام المحاولة بلا نهاية
    return textResponse_("error");
  }
}

/** فتح رابط تطبيق الويب في المتصفح يطمئنك أن النشر يعمل (تيليجرام يستخدم POST فقط) */
function doGet() {
  return textResponse_("بوت تذكير الضرائب يعمل ✅ — استخدم تيليجرام لإرسال الأوامر.");
}

/* ==========================================================================
 * 13) النشر وربط الويب هوك
 * ========================================================================== */

/** رابط تطبيق الويب المنشور */
function webAppUrl_() {
  var fixed = getProp_(P_URL);
  if (fixed) return fixed;
  try {
    return ScriptApp.getService().getUrl() || "";
  } catch (err) {
    return "";
  }
}

/**
 * ربط البوت برابط النشر — شغّلها مرة واحدة بعد النشر كتطبيق ويب.
 * تطبع النتيجة في السجل (عرض ← السجل / Executions).
 */
function setWebhook() {
  try {
    var url = webAppUrl_();
    if (!url) {
      Logger.log("❌ لا يوجد رابط نشر. انشر أولاً: نشر ← نشر جديد ← تطبيق ويب (التنفيذ باسمي، الوصول: أي شخص).");
      return "no url";
    }
    if (url.indexOf("https://script.google.com/") !== 0) {
      Logger.log("⚠️ الرابط لا يبدو رابط تطبيق ويب: " + url);
    }

    var payload = {
      url: url,
      allowed_updates: ["message", "edited_message", "channel_post"],
      drop_pending_updates: true,
      max_connections: 1
    };
    var secret = getProp_(P_SECRET);
    if (secret) payload.secret_token = secret;

    var res = telegramFetch_("setWebhook", payload);
    Logger.log("🔗 الرابط المستخدم: " + url);
    Logger.log("📥 رد تيليجرام: " + res.raw);
    if (res.ok) {
      Logger.log("✅ تم ربط الويب هوك بنجاح. أرسل للبوت: مساعدة");
    } else {
      Logger.log("❌ فشل الربط. تحقق من الرابط والصلاحيات (من يملك الوصول: أي شخص).");
    }
    return res.raw;
  } catch (err) {
    Logger.log("❌ خطأ أثناء setWebhook: " + err);
    return String(err);
  }
}

/** عرض حالة الويب هوك (أفضل أداة لكشف الأخطاء) */
function getWebhookInfo() {
  try {
    var res = telegramFetch_("getWebhookInfo", {});
    if (!res.ok) {
      Logger.log("❌ تعذّر جلب حالة الويب هوك: " + res.raw);
      return res.raw;
    }
    var info = res.data.result || {};
    Logger.log("🔗 الرابط الحالي: " + (info.url || "(لا يوجد ويب هوك)"));
    Logger.log("⏳ تحديثات منتظرة: " + (info.pending_update_count || 0));
    if (info.last_error_message) {
      var when = info.last_error_date ? new Date(info.last_error_date * 1000) : null;
      Logger.log("⚠️ آخر خطأ: " + info.last_error_message + (when ? " — بتاريخ " + when : ""));
    } else {
      Logger.log("✅ لا أخطاء مسجّلة.");
    }
    Logger.log("📄 التفاصيل الكاملة: " + JSON.stringify(info));
    return info;
  } catch (err) {
    Logger.log("❌ خطأ في getWebhookInfo: " + err);
    return String(err);
  }
}

/** حذف الويب هوك (لإيقاف البوت مؤقتاً أو لاستخدام getUpdates في معرفة رقم المحادثة) */
function deleteWebhook() {
  try {
    var res = telegramFetch_("deleteWebhook", { drop_pending_updates: false });
    Logger.log("📥 " + res.raw);
    Logger.log(res.ok ? "✅ حُذف الويب هوك." : "❌ تعذّر الحذف.");
    return res.raw;
  } catch (err) {
    Logger.log("❌ خطأ في deleteWebhook: " + err);
    return String(err);
  }
}

/**
 * معرفة رقم محادثتك بطريقة مضمونة (بديل أول).
 * الشرط: لا يوجد ويب هوك مفعّل (شغّل deleteWebhook أولاً)، ثم أرسل رسالة للبوت،
 * ثم شغّل هذه الدالة واقرأ السجل.
 */
function detectChatId() {
  try {
    var res = telegramFetch_("getUpdates", { timeout: 0, limit: 100 });
    if (!res.ok) {
      Logger.log(
        "⚠️ تعذّر قراءة التحديثات: " + (res.data && res.data.description ? res.data.description : res.raw)
      );
      Logger.log("غالباً الويب هوك مفعّل. شغّل deleteWebhook ثم أرسل رسالة للبوت ثم أعد المحاولة.");
      return res.raw;
    }
    var updates = res.data.result || [];
    if (!updates.length) {
      Logger.log("📭 لا توجد تحديثات. أرسل رسالة للبوت (أو داخل المجموعة) ثم شغّل detectChatId مرة أخرى.");
      return [];
    }
    var found = [];
    updates.forEach(function (u) {
      var m = u.message || u.edited_message || u.channel_post;
      if (!m || !m.chat) return;
      found.push({ id: m.chat.id, type: m.chat.type, title: m.chat.title || m.chat.first_name || m.chat.username || "" });
    });
    found.forEach(function (c) {
      Logger.log("👤 المحادثة: " + c.title + " — النوع: " + c.type + " — chat_id = " + c.id);
    });
    Logger.log("انسخ الرقم المناسب إلى الخاصية TELEGRAM_CHAT_ID (لمجموعة سيكون سالباً).");
    return found;
  } catch (err) {
    Logger.log("❌ خطأ في detectChatId: " + err);
    return String(err);
  }
}

/* ==========================================================================
 * 14) دوال تشخيص واختبار سريع
 * ========================================================================== */

/** فحص شامل للإعدادات: شغّلها إذا لم يعمل شيء */
function checkSetup() {
  invalidateRows_();
  var lines = [];
  try {
    var token = getProp_(P_TOKEN);
    lines.push(token ? "✅ التوكن: " + mask_(token) : "❌ التوكن غير مضبوط (TELEGRAM_TOKEN)");
    var chats = allowedChatIds_();
    lines.push(chats.length ? "✅ المحادثات المسموحة: " + chats.join(", ") : "❌ لا يوجد رقم محادثة (TELEGRAM_CHAT_ID)");
    var users = allowedUserIds_();
    if (users.length) lines.push("ℹ️ مستخدمون مسموح لهم فقط: " + users.join(", "));
    lines.push(getProp_(P_SECRET) ? "ℹ️ سر الويب هوك: مضبوط" : "ℹ️ سر الويب هوك: غير مضبوط (اختياري)");
    lines.push("ℹ️ المنطقة الزمنية: " + tz_());

    var ssId = getProp_(P_SHEET);
    if (ssId) {
      var ss = SpreadsheetApp.openById(ssId);
      lines.push("✅ الجدول: " + ss.getName() + " (" + ssId + ")");
      var m = ss.getSheetByName(SHEET_MONTHLY);
      var a = ss.getSheetByName(SHEET_ANNUAL);
      lines.push(m ? "✅ ورقة «" + SHEET_MONTHLY + "» موجودة" : "❌ ورقة «" + SHEET_MONTHLY + "» غير موجودة");
      lines.push(a ? "✅ ورقة «" + SHEET_ANNUAL + "» موجودة" : "❌ ورقة «" + SHEET_ANNUAL + "» غير موجودة");
    } else {
      lines.push("❌ SPREADSHEET_ID غير محفوظ — شغّل saveSpreadsheetId");
    }

    var all = rows_();
    lines.push("📄 صفوف «" + SHEET_MONTHLY + "»: " + all.monthly.length + " — «" + SHEET_ANNUAL + "»: " + all.annual.length);
    var noDue = all.monthly.concat(all.annual).filter(function (r) {
      return !r.dueKey;
    });
    if (noDue.length) {
      lines.push(
        "⚠️ صفوف بلا تاريخ استحقاق صالح (افحص تنسيق الخلية ليكون تاريخاً): الصفوف " +
          noDue
            .map(function (r) {
              return r.row;
            })
            .join(", ")
      );
    }
    var map = getReminderMap_();
    lines.push(
      map.items.length
        ? "✅ آخر تذكير: " + map.items.length + " التزاماً — " + (map.meta ? map.meta.savedAt : "")
        : "ℹ️ لا يوجد تذكير محفوظ بعد (لن يعمل «دفع 1» حتى ترسل تذكيراً)"
    );
    var url = webAppUrl_();
    lines.push(url ? "🔗 رابط النشر: " + url : "❌ لا يوجد رابط نشر");
  } catch (err) {
    lines.push("❌ خطأ أثناء الفحص: " + err);
  }
  var report = lines.join("\n");
  Logger.log("\n" + report);
  return report;
}

/** رسالة اختبار سريعة للتأكد من صحة التوكن ورقم المحادثة */
function sendTestMessage() {
  var ok = sendTelegram(
    "✅ اختبار ناجح!\nهذه رسالة تجريبية من بوت تذكير الضرائب.\n📅 " + todayKey() + "\n" + "أرسل «مساعدة» لعرض الأوامر."
  );
  Logger.log(ok ? "✅ وصلت الرسالة." : "❌ لم تصل الرسالة — راجع checkSetup().");
  return ok;
}

/**
 * ملاحظة: قد تجد في بعض الأمثلة دالة todayKey() بلا شرطة سفلية.
 * هذه إضافة صغيرة لتفادي الالتباس عند استدعائها يدوياً من المحرر.
 */
function todayKey() {
  return todayKey_();
}

/* ==========================================================================
 * 15) تهيئة الجدول من الصفر (لمن لا يملك جدولاً بعد)
 * ========================================================================== */

/** عدد الصفوف التي نجهّزها بخانة اختيار وتنسيق مسبقاً */
var SETUP_ROWS = 1000;

/**
 * 🧱 تنشئ ورقتَي «المتابعة» و«السنوية» بالعناوين والتنسيق وخانات الاختيار.
 * طريقة الاستخدام:
 *   1) افتح https://sheets.new ثم سمِّ الملف (مثال: تذكير الضرائب).
 *   2) من القائمة: الإضافات ← Apps Script ← الصق هذا الملف ← حفظ.
 *   3) اختر الدالة setupSheet ثم Run.
 * آمنة للتشغيل أكثر من مرة: لا تحذف بياناتك ولا تكتب فوق العناوين الموجودة.
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("افتح جدول Google Sheets أولاً، ثم: الإضافات ← Apps Script ← شغّل setupSheet.");
  }

  // نحفظ معرّف الجدول حتى يعمل تطبيق الويب والويب هوك لاحقاً
  if (!getProp_(P_SHEET)) setProp_(P_SHEET, ss.getId());

  var report = [];
  report.push("📄 الجدول: " + ss.getName());
  report = report.concat(
    setupOneSheet_(
      ss,
      SHEET_MONTHLY,
      ["الوحدة", "الشقة", "الوصل", "تاريخ الاستحقاق", "المبلغ", "مدفوع"],
      { dateCol: M_DUE, amountCol: M_AMOUNT, paidCol: M_PAID, widths: [80, 80, 80, 140, 120, 80] },
      0
    )
  );
  report = report.concat(
    setupOneSheet_(
      ss,
      SHEET_ANNUAL,
      ["الوحدة", "تاريخ الاستحقاق", "المبلغ", "مدفوع"],
      { dateCol: A_DUE, amountCol: A_AMOUNT, paidCol: A_PAID, widths: [160, 140, 120, 80] },
      1
    )
  );

  // تنبيه لطيف عن أوراق فارغة أخرى (مثل «ورقة1» في الجدول الجديد)
  var others = [];
  try {
    ss.getSheets().forEach(function (sh) {
      var nm = sh.getName();
      if (nm === SHEET_MONTHLY || nm === SHEET_ANNUAL) return;
      if (sh.getLastRow() <= 1) others.push(nm);
    });
  } catch (err) {
    others = [];
  }
  if (others.length) {
    report.push("💡 يمكنك حذف الورقة الفارغة غير المستخدمة: " + others.join("، "));
  }

  report.push("");
  report.push("✅ الجدول جاهز. الخطوات التالية: BotFather ← الخصائص ← النشر ← setWebhook.");
  report.push("💡 لتجربة سريعة: شغّل addSampleData لإضافة صفوف تجريبية ثم sendTestReminder.");

  var text = report.join("\n");
  Logger.log("\n" + text);
  return text;
}

/** تجهيز ورقة واحدة (تُستدعى من setupSheet) */
function setupOneSheet_(ss, name, headers, cols, index) {
  var report = [];
  var sheet = ss.getSheetByName(name);
  var created = false;
  if (!sheet) {
    sheet = ss.insertSheet(name, index);
    created = true;
  }
  report.push((created ? "🆕 أنشأت ورقة «" : "🔎 ورقة موجودة «") + name + "»");

  // 1) صف العناوين (لا نكتب فوق عناوين مختلفة موجودة مسبقاً)
  var headerRange = sheet.getRange(HEADER_ROWS, 1, 1, headers.length);
  var current = headerRange.getValues()[0].map(function (v) {
    return str_(v);
  });
  var filled = current.filter(function (v) {
    return v !== "";
  }).length;
  var identical = true;
  for (var i = 0; i < headers.length; i++) {
    if (current[i] !== headers[i]) identical = false;
  }
  if (filled === 0 || identical) {
    headerRange.setValues([headers]);
    report.push("   • العناوين: " + headers.join(" | "));
  } else {
    report.push("   ⚠️ وجدت عناوين مختلفة في الصف الأول فلم أعدّلها: " + current.join(" | "));
  }

  // 2) تنسيق العناوين وتثبيت الصف
  headerRange
    .setFontWeight("bold")
    .setBackground("#1f4e5f")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setFrozenRows(HEADER_ROWS);
  try {
    sheet.setTabColor("#1f4e5f");
  } catch (err) {
    // تنسيق اختياري فقط
  }

  // 3) عرض الأعمدة
  if (cols.widths) {
    for (var c = 0; c < cols.widths.length; c++) sheet.setColumnWidth(c + 1, cols.widths[c]);
  }

  // 4) تنسيق التاريخ والمبلغ
  var dataRange = sheet.getRange(HEADER_ROWS + 1, 1, SETUP_ROWS, Math.max(cols.paidCol, headers.length));
  sheet.getRange(HEADER_ROWS + 1, cols.dateCol, SETUP_ROWS, 1).setNumberFormat("yyyy-mm-dd");
  sheet.getRange(HEADER_ROWS + 1, cols.amountCol, SETUP_ROWS, 1).setNumberFormat("#,##0");
  try {
    dataRange.setVerticalAlignment("middle");
  } catch (err) {
    // اختياري
  }

  // 5) خانة الاختيار في عمود «مدفوع»
  var paidRange = sheet.getRange(HEADER_ROWS + 1, cols.paidCol, SETUP_ROWS, 1);
  try {
    paidRange.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  } catch (err) {
    report.push("   ⚠️ تعذّر ضبط خانة الاختيار: " + err);
  }
  try {
    paidRange.setHorizontalAlignment("center");
  } catch (err) {
    // اختياري
  }

  // 6) تعبئة الخانات الفارغة بـ FALSE حتى تظهر كخانات اختيار غير مفعّلة
  //    (لا نلمس أي صف مسجّل مدفوعاً مسبقاً)
  var values = paidRange.getValues();
  var changed = 0;
  for (var r = 0; r < values.length; r++) {
    var v = values[r][0];
    if (v === "" || v === null || v === undefined) {
      values[r][0] = false;
      changed++;
    }
  }
  if (changed) paidRange.setValues(values);
  report.push("   • خانة اختيار «مدفوع» جاهزة في " + SETUP_ROWS + " صفاً");
  return report;
}

/**
 * 🧪 صفوف تجريبية لاختبار البوت (شهرين + ضريبة سنوية).
 * تُضاف مرة واحدة فقط إذا كانت الورقتان بلا بيانات. احذف الصفوف بعد الاختبار.
 */
function addSampleData() {
  var ss = getSpreadsheet_();
  var monthly = ss.getSheetByName(SHEET_MONTHLY);
  var annual = ss.getSheetByName(SHEET_ANNUAL);
  if (!monthly || !annual) {
    throw new Error("شغّل setupSheet أولاً لإنشاء الورقتين.");
  }
  if (readMonthly_(monthly).length || readAnnual_(annual).length) {
    var msg = "ℹ️ توجد بيانات بالفعل في الجدول، لم أضف صفوفاً تجريبية.";
    Logger.log(msg);
    return msg;
  }

  var today = new Date();
  var y = today.getFullYear();
  var m = today.getMonth(); // 0 = يناير
  var day5 = new Date(y, m, 5);
  var firstOfMonth = new Date(y, m, 1);
  var firstOfPrevMonth = new Date(y, m - 1, 1);

  // الوحدة | الشقة | الوصل | تاريخ الاستحقاق | المبلغ | مدفوع
  var monthlyRows = [
    [1, 1, 1, day5, 1500, false],
    [2, 5, 2, day5, 1500, false],
    [1, 1, 1, firstOfPrevMonth, 1500, true], // مثال مدفوع مسبقاً
    [3, 2, 1, firstOfMonth, 1200, false]
  ];
  monthly.getRange(HEADER_ROWS + 1, 1, monthlyRows.length, monthlyRows[0].length).setValues(monthlyRows);

  // الوحدة | تاريخ الاستحقاق | المبلغ | مدفوع
  var annualRows = [
    [1, new Date(y, 11, 31), 5000, false],
    [2, new Date(y, 5, 30), 4800, false]
  ];
  annual.getRange(HEADER_ROWS + 1, 1, annualRows.length, annualRows[0].length).setValues(annualRows);

  var msg =
    "🧪 أُضيفت " +
    monthlyRows.length +
    " صفوف تجريبية في «" +
    SHEET_MONTHLY +
    "» و" +
    annualRows.length +
    " في «" +
    SHEET_ANNUAL +
    "».\n" +
    "شغّل sendTestReminder ثم أرسل للبوت: دفع 1\n" +
    "⚠️ احذف هذه الصفوف قبل إدخال بياناتك الحقيقية.";
  Logger.log(msg);
  return msg;
}

/* ==========================================================================
 * 16) أسماء عربية مختصرة (اختيارية) — نفس الدوال، تسهيلاً للاستخدام
 * ========================================================================== */

function حفظ_معرّف_الجدول() {
  return saveSpreadsheetId();
}
function إرسال_تذكير_الشهر() {
  return sendMonthlyReminder();
}
function إرسال_تذكير_تجريبي() {
  return sendTestReminder();
}
function إرسال_رسالة_اختبار() {
  return sendTestMessage();
}
function ربط_الويب_هوك() {
  return setWebhook();
}
function حالة_الويب_هوك() {
  return getWebhookInfo();
}
function حذف_الويب_هوك() {
  return deleteWebhook();
}
function اكتشف_رقم_المحادثة() {
  return detectChatId();
}
function فحص_الإعدادات() {
  return checkSetup();
}
function تهيئة_الجدول() {
  return setupSheet();
}
function إضافة_بيانات_تجريبية() {
  return addSampleData();
}
