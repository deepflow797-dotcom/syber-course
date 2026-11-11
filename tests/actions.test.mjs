/* Unit tests for the `[data-action]` dispatch tables introduced in P1 (22c-actions-forms / 22d-actions-settings).
   The tables are pure objects of handlers, so they can be built with a stub ctx and called directly. */
import test from "node:test";
import assert from "node:assert/strict";
import { actionPayload, runAction } from "../assets/js/ui/dashboard/22c-actions-forms.js";
import { buildSettingsActions } from "../assets/js/ui/dashboard/22d-actions-settings.js";

const calls = [];
const ctx = {
  dt: (ar, fr) => fr || ar,
  toast: (...args) => calls.push(["toast", ...args]),
  renderRoute: () => calls.push(["renderRoute"]),
  saveDraftNow: () => calls.push(["saveDraftNow"]),
  saveDraftSoon: () => calls.push(["saveDraftSoon"]),
  clone: (value) => JSON.parse(JSON.stringify(value)),
  tablesMode: () => false,
  session: null,
  model: { settings: { coupons: [], payments: [], cities: [], social: [] } }
};

test("runAction: dispatches to the handler and reports whether it ran", () => {
  let seen = null;
  assert.equal(runAction({ ping: (payload) => (seen = payload) }, "ping", { ctx, node: null, event: null }), true);
  assert.deepEqual(seen, { ctx, node: null, event: null });
  assert.equal(runAction({}, "missing", { ctx }), false);
  // a non-function entry must not throw
  assert.equal(runAction({ ping: "nope" }, "ping", { ctx }), false);
});

test("actionPayload: decodes data-index and data-id from the clicked node", () => {
  const node = { dataset: { index: "3", id: "ord-9" } };
  const payload = actionPayload(ctx, node, { type: "click" });
  assert.equal(payload.index, 3);
  assert.equal(payload.id, "ord-9");
  assert.equal(payload.ctx, ctx);
  const empty = actionPayload(ctx, { dataset: {} }, null);
  assert.equal(empty.index, null);
  assert.equal(empty.id, "");
});

test("buildSettingsActions: every table entry is a callable handler", () => {
  const actions = buildSettingsActions(ctx);
  const names = Object.keys(actions);
  assert.ok(names.length >= 40, `expected the full settings table, got ${names.length}`);
  for (const name of names) assert.equal(typeof actions[name], "function", `${name} is not a function`);
  // The table must not contain duplicates hidden by the spread (a duplicate would silently win).
  assert.equal(new Set(names).size, names.length);
});

test("buildSettingsActions: owner-only actions refuse a manager session", () => {
  calls.length = 0;
  const actions = buildSettingsActions(ctx);
  assert.equal(typeof actions["add-social-link"], "function");
  actions["add-social-link"]();
  assert.deepEqual(calls[0], ["toast", "Propriétaire uniquement", "error"]);
  assert.equal(ctx.model.settings.social.length, 0);
});
