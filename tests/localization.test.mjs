import test from "node:test";
import assert from "node:assert/strict";
import { pickText } from "../lib/text.ts";
import { validateCatalog } from "../lib/catalog-validation.ts";
import { buildWhatsAppMessage, formatPrice } from "../lib/cart.ts";
import { addToCart } from "../lib/cart.ts";
import { createSeedCatalog } from "../lib/menu-data.ts";

test("prices read the way Moroccan menus write them", () => {
  assert.equal(formatPrice(6800), "68 DH");
  assert.equal(formatPrice(6850, "fr"), "68,50 DH");
  assert.equal(formatPrice(6800, "ar"), "68 درهم");
  assert.equal(formatPrice(150000, "fr").replace(/\s/g, " "), "1 500 DH");
});

test("missing translations fall back instead of showing blanks", () => {
  assert.equal(pickText({ en: "Tea", fr: "Thé", ar: "شاي" }, "fr"), "Thé");
  assert.equal(pickText({ en: "", fr: "Thé", ar: "" }, "ar"), "Thé");
  assert.equal(pickText({ en: "Tea", fr: "", ar: "" }, "ar"), "Tea");
  assert.equal(pickText({ en: "", fr: "", ar: "شاي" }, "en"), "شاي");
});

test("owners can save a dish in just one language, but not in none", () => {
  const catalog = createSeedCatalog();
  catalog.items[0].name = { en: "", fr: "Tartine verte", ar: "" };
  catalog.items[0].description = { en: "", fr: "", ar: "" };
  catalog.categories[0].name = { en: "", fr: "", ar: "فطور" };
  const saved = validateCatalog(catalog);
  assert.equal(saved.items[0].name.fr, "Tartine verte");
  assert.equal(saved.items[0].description.en, "");

  // Customers in another language still see the dish name.
  const cart = addToCart([], saved.items[0]);
  const message = buildWhatsAppMessage(
    cart,
    saved,
    { name: "Sara", type: "takeaway", table: "", address: "", notes: "" },
    "en",
  );
  assert.match(message, /1 × Tartine verte — 68 DH/);

  catalog.items[0].name = { en: " ", fr: "", ar: "" };
  assert.throws(() => validateCatalog(catalog), /at least one language/);
});
