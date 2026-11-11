/* P4 — backup format rules (pure module, no browser). The dashboard UI is a thin shell over these functions, so
   this file is where the guarantees live: a backup round-trips exactly, a malformed or newer file is rejected with a
   code the UI can show, and merging never drops settings the current version has but the file predates. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupFileName,
  createBackup,
  describeState,
  diffBackup,
  mergeImportedState,
  parseBackupText,
  validateBackup
} from "../assets/js/domain/backup-format.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

function sampleState() {
  return {
    version: 3,
    updatedAt: "2026-11-01T10:00:00.000Z",
    settings: {
      storeName: { ar: "متجر", fr: "Boutique" },
      homeSections: [{ id: "s1" }, { id: "s2" }],
      coupons: [{ code: "OLD10" }],
      pixels: { meta: "123" }
    },
    products: [{ handle: "p1" }, { handle: "p2" }, { handle: "p3" }],
    collections: [{ handle: "all" }],
    pages: [{ slug: "about" }],
    blog: [],
    theme: { categories: [{ id: "c1" }] },
    home: { anniversary: ["p1"] },
    faqs: [],
    homeReviews: [],
    press: [],
    reviews: []
  };
}

const ctx = { clone, nowISO: () => "2026-11-11T08:30:00.000Z", app: "1.7.0" };

test("createBackup wraps the state in an identifying envelope and clones the payload", () => {
  const state = sampleState();
  const doc = createBackup(state, ctx);
  assert.equal(doc.format, BACKUP_FORMAT);
  assert.equal(doc.formatVersion, BACKUP_FORMAT_VERSION);
  assert.equal(doc.exportedAt, "2026-11-11T08:30:00.000Z");
  assert.equal(doc.version, 3);
  assert.equal(doc.data.products.length, 3);
  assert.notEqual(doc.data, state, "payload must be a copy, not a live reference");
  state.products.push({ handle: "p4" });
  assert.equal(doc.data.products.length, 3, "later edits to the store must not leak into an existing backup");
});

test("a backup round-trips through JSON and validation without losing a byte", () => {
  const state = sampleState();
  const text = JSON.stringify(createBackup(state, ctx), null, 2);
  const parsed = parseBackupText(text);
  assert.deepEqual(parsed.data, state);
  assert.deepEqual(
    parsed.keys.sort(),
    Object.keys(state)
      .filter((key) => key !== "version" && key !== "updatedAt")
      .sort(),
    "every section is listed as imported; metadata is carried but not counted"
  );
});

test("describeState reports the counts the import screen shows", () => {
  assert.deepEqual(describeState(sampleState()), {
    products: 3,
    collections: 1,
    pages: 1,
    blog: 0,
    categories: 1,
    homeSections: 2,
    coupons: 1,
    storeName: { ar: "متجر", fr: "Boutique" },
    updatedAt: "2026-11-01T10:00:00.000Z"
  });
});

test("describeState survives an empty or broken tree", () => {
  assert.equal(describeState({}).products, 0);
  assert.equal(describeState(undefined).pages, 0);
  assert.equal(describeState({ products: "nope" }).products, 0);
});

test("backupFileName is sortable and free of spaces", () => {
  assert.equal(backupFileName("2026-11-11T08:30:00.000Z"), "restore-backup-2026-11-11-0830.json");
  assert.match(backupFileName("not a date"), /^restore-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
});

test("validation rejects every way a file can be wrong, with a code", () => {
  const doc = () => createBackup(sampleState(), ctx);
  const cases = [
    [() => null, "not-an-object"],
    [() => [], "not-an-object"],
    [() => ({ ...doc(), format: "something-else" }), "not-a-backup"],
    [() => ({ ...doc(), formatVersion: 0 }), "bad-format-version"],
    [() => ({ ...doc(), formatVersion: "1" }), "bad-format-version"],
    [() => ({ ...doc(), formatVersion: BACKUP_FORMAT_VERSION + 1 }), "future-format"],
    [() => ({ ...doc(), data: null }), "no-data"],
    [() => ({ ...doc(), data: [] }), "no-data"],
    [() => ({ ...doc(), data: { ...sampleState(), products: "nope" } }), "bad-products"],
    [() => ({ ...doc(), data: { ...sampleState(), collections: 5 } }), "bad-collections"],
    [() => ({ ...doc(), data: { ...sampleState(), settings: [] } }), "bad-settings"],
    [() => ({ ...doc(), data: { unknownKey: 1 } }), "empty-data"]
  ];
  for (const [make, code] of cases) {
    assert.throws(
      () => validateBackup(make()),
      (error) => error.code === code,
      `expected ${code}`
    );
  }
});

test("parseBackupText reports invalid JSON distinctly from a valid-JSON wrong file", () => {
  assert.throws(
    () => parseBackupText("{oops"),
    (error) => error.code === "invalid-json"
  );
  assert.throws(
    () => parseBackupText('{"a":1}'),
    (error) => error.code === "not-a-backup"
  );
  assert.throws(
    () => parseBackupText(""),
    (error) => error.code === "invalid-json"
  );
});

test("a file from an older store version is accepted (only a newer one is refused)", () => {
  const old = createBackup(sampleState(), ctx);
  old.formatVersion = 1;
  old.app = "1.6.0";
  assert.equal(validateBackup(old).app, "1.6.0");
});

test("diffBackup lists the fields that change and notices an identical file", () => {
  const current = sampleState();
  const same = diffBackup(current, clone(current));
  assert.equal(same.identical, true);
  assert.deepEqual(same.changes, []);

  const incoming = clone(current);
  incoming.products.push({ handle: "p9" }, { handle: "p10" });
  incoming.pages = [];
  incoming.settings.storeName = { ar: "جديد", fr: "Nouveau" };
  const diff = diffBackup(current, incoming);
  assert.equal(diff.identical, false);
  assert.equal(diff.storeNameChanged, true);
  const byKey = Object.fromEntries(diff.changes.map((row) => [row.key, row]));
  assert.deepEqual(byKey.products, { key: "products", from: 3, to: 5 });
  assert.deepEqual(byKey.pages, { key: "pages", from: 1, to: 0 });
  assert.equal(byKey.settings, undefined, "settings is compared by name, not by size");
});

test("mergeImportedState replaces sections but never drops settings the file predates", () => {
  const current = sampleState();
  current.settings.newInThisVersion = true;
  const incoming = clone(sampleState());
  delete incoming.settings.newInThisVersion;
  incoming.settings.pixels = { meta: "999" };
  incoming.products = [{ handle: "only" }];

  const merged = mergeImportedState(current, incoming);
  assert.equal(merged.settings.newInThisVersion, true, "unknown new setting survives an old backup");
  assert.deepEqual(merged.settings.pixels, { meta: "999" }, "the file still wins for fields it has");
  assert.deepEqual(merged.products, [{ handle: "only" }], "arrays replace wholesale");
});

test("mergeImportedState ignores keys that are not part of the state tree", () => {
  const merged = mergeImportedState({ settings: {} }, { settings: {}, injected: "x", __proto__: null });
  assert.equal("injected" in merged, false);
});
