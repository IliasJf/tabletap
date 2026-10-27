import test from "node:test";
import assert from "node:assert/strict";
import {
  addToCart,
  buildMenuUrl,
  buildWhatsAppMessage,
  calculateCart,
  createWhatsAppUrl,
  sanitizeCart,
  updateCartQuantity,
  validateOrder,
} from "../lib/cart.ts";
import { createSeedCatalog } from "../lib/menu-data.ts";

test("cart totals include each option once, quantity, and delivery, using exact minor units", () => {
  const catalog = createSeedCatalog();
  const toast = catalog.items.find((item) => item.id === "avocado-toast");
  const coffee = catalog.items.find((item) => item.id === "flat-white");
  let cart = addToCart([], toast, ["egg", "egg", "avocado"], 2);
  cart = addToCart(cart, coffee, ["oat"]);
  const totals = calculateCart(cart, catalog.items, 1500);
  assert.equal(totals.subtotal, (6800 + 1200 + 1500) * 2 + 3200 + 600);
  assert.equal(totals.total, 24300);
  assert.equal(totals.itemCount, 3);
});

test("equivalent options merge while distinct customizations stay separate", () => {
  const item = createSeedCatalog().items[0];
  let cart = addToCart([], item, ["egg", "avocado"]);
  cart = addToCart(cart, item, ["avocado", "egg"]);
  cart = addToCart(cart, item, []);
  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 2);
  assert.equal(updateCartQuantity(cart, cart[0].key, 0).length, 1);
});

test("persisted cart cannot inject prices, options, unknown or unavailable items", () => {
  const catalog = createSeedCatalog();
  const cart = sanitizeCart(
    [
      {
        itemId: "avocado-toast",
        optionIds: ["egg", "free-secret-addon"],
        quantity: 1,
        price: -9000,
      },
      { itemId: "orange-cake", optionIds: [], quantity: 1 },
      { itemId: "does-not-exist", optionIds: [], quantity: 1 },
      { itemId: "flat-white", optionIds: [], quantity: -2 },
      null,
    ],
    catalog.items,
  );
  assert.equal(cart.length, 1);
  assert.deepEqual(cart[0].optionIds, ["egg"]);
  assert.equal(calculateCart(cart, catalog.items).total, 8000);
  assert.equal(calculateCart([], catalog.items, 1500).total, 0);
});

test("cart recalculates from the latest menu and removes newly unavailable dishes", () => {
  const catalog = createSeedCatalog();
  const cart = addToCart([], catalog.items[0], [], 2);
  catalog.items[0].price = 7100;
  assert.equal(calculateCart(cart, catalog.items).total, 14200);
  catalog.items[0].available = false;
  assert.equal(calculateCart(cart, catalog.items).total, 0);
});

test("WhatsApp link round-trips multilingual text and requires a configured phone", () => {
  const catalog = createSeedCatalog();
  const cart = addToCart([], catalog.items[0], ["egg"], 2);
  const details = {
    name: "Amal & Ali",
    type: "delivery",
    table: "",
    address: "Rue des Fleurs 12",
    notes: "بدون فلفل & merci",
  };
  const message = buildWhatsAppMessage(cart, catalog, details, "ar");
  const url = new URL(createWhatsAppUrl("+212 600 000 000", message));
  assert.equal(url.searchParams.get("text"), message);
  assert.match(message, /Rue des Fleurs 12/);
  assert.match(message, /بدون فلفل & merci/);
  assert.match(message, /بيضة بلدية/);
  assert.match(message, /يرجى تأكيد/);
  assert.throws(() => createWhatsAppUrl("", message), /not configured/);
});

test("checkout requires appropriate details and never builds an empty order", () => {
  const catalog = createSeedCatalog();
  const details = {
    name: "Amal",
    type: "dine-in",
    table: "",
    address: "",
    notes: "",
  };
  assert.match(validateOrder(details), /table/);
  assert.equal(validateOrder({ ...details, table: "5" }), null);
  assert.match(validateOrder({ ...details, type: "delivery" }), /address/);
  assert.throws(
    () => buildWhatsAppMessage([], catalog, { ...details, table: "5" }),
    /empty/,
  );
});

test("QR menu links preserve shop and table safely", () => {
  const url = new URL(
    buildMenuUrl("https://cafe.example/", "owner/with?symbols", "5 & 6"),
  );
  assert.equal(url.pathname, "/menu");
  assert.equal(url.searchParams.get("shop"), "owner/with?symbols");
  assert.equal(url.searchParams.get("table"), "5 & 6");
  assert.throws(() => buildMenuUrl("javascript:alert(1)"), /valid/);
});
