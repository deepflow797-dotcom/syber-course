// @ts-check
/* state.js → Utilities shared by auth, reviews and media
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, { safeHref, bytesToHex, hexToBytes, weakHash, hashPassword, verifyPassword, validatePassword });
  const normalizeEmail = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
  const uniqueStrings = (list) => [
    ...new Set((Array.isArray(list) ? list : []).map((item) => String(item || "").trim()).filter(Boolean))
  ];

  function safeHref(value, fallback = "#") {
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    if (raw.startsWith("#") || raw.startsWith("/")) return raw;
    try {
      const parsed = new URL(raw, location.href);
      if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) return raw;
    } catch {}
    return fallback;
  }

  function bytesToHex(buffer) {
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function hexToBytes(hex) {
    const clean = String(hex || "").replace(/[^0-9a-f]/gi, "");
    const out = new Uint8Array(clean.length / 2);
    for (let index = 0; index < out.length; index += 1)
      out[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
    return out;
  }
  function weakHash(text) {
    let hash = 0x811c9dc5;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `weak$${hash.toString(16)}$${value.length}`;
  }
  async function hashPassword(password) {
    const plain = String(password || "");
    if (!window.crypto?.subtle) return weakHash(`${ctx.SALT}${plain}`);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      key,
      256
    );
    return `pbkdf2$150000$${bytesToHex(salt)}$${bytesToHex(bits)}`;
  }
  async function verifyPassword(password, stored) {
    const plain = String(password || "");
    const marker = String(stored || "");
    if (!marker) return false;
    if (marker.startsWith("weak$")) return marker === weakHash(`${ctx.SALT}${plain}`);
    if (!marker.startsWith("pbkdf2$")) return false;
    if (!window.crypto?.subtle) return false;
    const [, iterations, saltHex, digestHex] = marker.split("$");
    try {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, [
        "deriveBits"
      ]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: Number(iterations) || 150000, hash: "SHA-256" },
        key,
        256
      );
      const expected = hexToBytes(digestHex);
      const actual = new Uint8Array(bits);
      if (expected.length !== actual.length) return false;
      let diff = 0;
      for (let index = 0; index < actual.length; index += 1) diff |= actual[index] ^ expected[index];
      return diff === 0;
    } catch {
      return false;
    }
  }
  function validatePassword(password) {
    const value = String(password || "");
    if (value.length < 8) throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل / 8 caractères minimum");
    if (value.length > 128) throw new Error("كلمة المرور طويلة جدًا");
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value))
      throw new Error("كلمة المرور يجب أن تحتوي على حروف وأرقام / Lettres et chiffres requis");
    return value;
  }
  Object.assign(ctx, { normalizeEmail, normalizeDigits, isEmail, uniqueStrings });
}
