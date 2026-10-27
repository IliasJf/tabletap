import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createPreviewServer } from "../scripts/preview-server.mjs";
import { createSeedCatalog } from "../lib/menu-data.ts";
import { signIn } from "./sign-in.mjs";
import {
  slugify,
  upgradeStoredCatalog,
  validateCatalog,
} from "../lib/catalog-validation.ts";
import { addToCart } from "../lib/cart.ts";
import { buildOrderRecord } from "../lib/orders.ts";
import {
  base64ToBytes,
  bytesToBase64,
  detectImageType,
} from "../lib/images.ts";

const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

test("owners can define, rename and reorder menu sections; dishes must use one", () => {
  const catalog = createSeedCatalog();
  catalog.categories.push({
    id: "tagines",
    name: { en: "Tagines", fr: "Tajines", ar: "طواجن" },
  });
  catalog.items[0].category = "tagines";
  assert.equal(validateCatalog(catalog).categories.at(-1).name.fr, "Tajines");
  catalog.items[0].category = "missing";
  assert.throws(() => validateCatalog(catalog), /valid menu category/);
  catalog.items[0].category = "brunch";
  catalog.categories.push({ ...catalog.categories[0] });
  assert.throws(() => validateCatalog(catalog), /unique ID/);
  assert.throws(
    () => validateCatalog({ ...createSeedCatalog(), categories: [] }),
    /categories/,
  );
});

test("menus saved before sections and link names existed keep loading", () => {
  const legacy = createSeedCatalog();
  delete legacy.categories;
  delete legacy.settings.slug;
  const upgraded = validateCatalog(upgradeStoredCatalog(legacy));
  assert.deepEqual(
    upgraded.categories.map((entry) => entry.id),
    ["brunch", "mains", "coffee", "desserts"],
  );
  assert.equal(upgraded.settings.slug, "");
});

test("menu link names are readable and strictly shaped", () => {
  assert.equal(slugify("Olive & Ember"), "olive-and-ember");
  assert.equal(slugify("  Café Hafa — Tanger! "), "cafe-hafa-tanger");
  const catalog = createSeedCatalog();
  catalog.settings.slug = "Olive-And-Ember";
  assert.equal(validateCatalog(catalog).settings.slug, "olive-and-ember");
  for (const bad of ["ab", "-cafe", "cafe-", "café", "a/b", "x".repeat(61)]) {
    catalog.settings.slug = bad;
    assert.throws(() => validateCatalog(catalog), /link name/, bad);
  }
});

test("uploaded photo paths are accepted only in their exact shape", () => {
  const catalog = createSeedCatalog();
  catalog.items[0].image = `/api/images/${"a".repeat(32)}`;
  assert.doesNotThrow(() => validateCatalog(catalog));
  catalog.items[0].image = "/api/images/../admin/catalog";
  assert.throws(() => validateCatalog(catalog), /photo/);
});

test("photo checks trust file bytes and round-trip through base64", () => {
  assert.equal(detectImageType(PNG), "image/png");
  assert.equal(
    detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0])),
    "image/jpeg",
  );
  assert.equal(
    detectImageType(new TextEncoder().encode("<svg onload=x>")),
    null,
  );
  assert.deepEqual(base64ToBytes(bytesToBase64(PNG)), PNG);
});

test("orders are priced from the saved menu, never the browser", () => {
  const catalog = createSeedCatalog();
  const toast = catalog.items.find((item) => item.id === "avocado-toast");
  const cart = addToCart([], toast, ["egg"], 2);
  cart.push({ key: "x", itemId: "orange-cake", optionIds: [], quantity: 5 });
  const order = buildOrderRecord(
    {
      id: "f".repeat(32),
      cart: cart.map((row) => ({ ...row, price: 1 })),
      details: {
        name: " Sara ",
        type: "delivery",
        table: "",
        address: "12 Rue Atlas",
        notes: "",
      },
      language: "fr",
    },
    catalog,
    1000,
  );
  assert.equal(order.itemCount, 2, "sold-out dishes are dropped");
  assert.equal(order.subtotal, (6800 + 1200) * 2);
  assert.equal(order.total, order.subtotal + catalog.settings.deliveryFee);
  assert.equal(order.name, "Sara");
  assert.deepEqual(order.lines[0].options, ["Free-range egg"]);
  assert.throws(
    () => buildOrderRecord({ id: "nope", cart, details: {} }, catalog),
    /reference/,
  );
});

test("local adapter serves link names, uploaded photos and the owner's order log", async () => {
  const server = await createPreviewServer({ databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const { cookie, userId } = await signIn(origin);
    const headers = { cookie, origin, "content-type": "application/json" };

    // Photos: owners only, real image bytes only.
    assert.equal(
      (await fetch(origin + "/api/admin/images", { method: "POST", body: PNG }))
        .status,
      401,
    );
    const rejected = await fetch(origin + "/api/admin/images", {
      method: "POST",
      headers: { cookie, origin, "content-type": "image/png" },
      body: "<svg/>",
    });
    assert.equal(rejected.status, 415);
    const uploaded = await fetch(origin + "/api/admin/images", {
      method: "POST",
      headers: { cookie, origin, "content-type": "image/png" },
      body: PNG,
    });
    assert.equal(uploaded.status, 201);
    const { url } = await uploaded.json();
    const photo = await fetch(origin + url);
    assert.equal(photo.headers.get("content-type"), "image/png");
    assert.match(photo.headers.get("content-security-policy"), /sandbox/);
    assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), PNG);

    // Link names resolve; the owner ID link keeps working too.
    const catalog = createSeedCatalog();
    catalog.settings.slug = "olive-and-ember";
    catalog.items[0].image = url;
    const saved = await fetch(origin + "/api/admin/catalog", {
      method: "PUT",
      headers,
      body: JSON.stringify(catalog),
    });
    assert.equal(saved.status, 200);
    for (const shop of ["olive-and-ember", "OLIVE-AND-EMBER", userId])
      assert.equal(
        (await fetch(`${origin}/api/catalog?shop=${shop}`)).status,
        200,
        shop,
      );

    // Orders: anonymous customers, same-origin, idempotent per order ID.
    const order = {
      id: "a".repeat(32),
      shop: "olive-and-ember",
      cart: [{ itemId: "avocado-toast", optionIds: [], quantity: 1 }],
      details: {
        name: "Sara",
        type: "dine-in",
        table: "5",
        address: "",
        notes: "",
      },
      language: "en",
    };
    const post = (body, extra = {}) =>
      fetch(origin + "/api/orders", {
        method: "POST",
        headers: { origin, "content-type": "application/json", ...extra },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post(order, { origin: "https://foreign.example" })).status,
      403,
    );
    assert.equal((await post({ ...order, shop: "nobody" })).status, 404);
    assert.equal((await post({ ...order, cart: [] })).status, 400);
    assert.equal((await post(order)).status, 201);
    assert.equal((await post(order)).status, 201);
    assert.equal(
      (await fetch(origin + "/api/admin/orders")).status,
      401,
      "customers cannot read the order log",
    );
    const log = await (
      await fetch(origin + "/api/admin/orders", { headers: { cookie } })
    ).json();
    assert.equal(log.orders.length, 1, "repeated Send taps record one order");
    assert.equal(log.orders[0].table, "5");
    assert.equal(log.orders[0].total, 6800);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("owners move orders through statuses; others cannot", async () => {
  const server = await createPreviewServer({ databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const { cookie, userId } = await signIn(origin);
    const json = { origin, "content-type": "application/json" };
    await fetch(origin + "/api/admin/catalog", {
      method: "PUT",
      headers: { ...json, cookie },
      body: JSON.stringify(createSeedCatalog()),
    });
    const id = "b".repeat(32);
    await fetch(origin + "/api/orders", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        id,
        shop: userId,
        cart: [{ itemId: "flat-white", optionIds: [], quantity: 1 }],
        details: {
          name: "Omar",
          type: "takeaway",
          table: "",
          address: "",
          notes: "",
        },
      }),
    });
    const patch = (body, headers = { ...json, cookie }) =>
      fetch(origin + "/api/admin/orders", {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
    const list = async () =>
      (
        await (
          await fetch(origin + "/api/admin/orders", { headers: { cookie } })
        ).json()
      ).orders;

    assert.equal((await list())[0].status, "new");
    assert.equal((await patch({ id, status: "preparing" }, json)).status, 401);
    assert.equal(
      (
        await patch(
          { id, status: "preparing" },
          { ...json, cookie, origin: "https://foreign.example" },
        )
      ).status,
      403,
    );
    assert.equal((await patch({ id, status: "eaten" })).status, 400);
    assert.equal(
      (await patch({ id: "c".repeat(32), status: "done" })).status,
      404,
    );
    const updated = await patch({ id, status: "preparing" });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).status, "preparing");
    await patch({ id, status: "done" });
    const [order] = await list();
    assert.equal(order.status, "done");
    assert.equal(order.total, 3200, "status changes never touch prices");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
