import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  assertSameOrigin,
  readBoundedJson,
  requireOwnerId,
} from "../lib/api-security.ts";
import { validateCatalog } from "../lib/catalog-validation.ts";
import { createSeedCatalog } from "../lib/menu-data.ts";

const request = (headers = {}, body = "{}") =>
  new Request("https://cafe.example/api/admin/catalog", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

test("anonymous users cannot select a writable owner; authenticated identity supplies it", () => {
  assert.throws(
    () => requireOwnerId(null),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.throws(
    () => requireOwnerId({ userId: "" }),
    (error) => error.status === 401,
  );
  assert.equal(
    requireOwnerId({ userId: "server-user-123", ownerId: "attacker-target" }),
    "server-user-123",
  );
});

test("write origin check rejects foreign, null and missing origins", () => {
  for (const origin of [
    "https://attacker.example",
    "null",
    "https://cafe.example.attacker.example",
  ]) {
    assert.throws(
      () => assertSameOrigin(request({ Origin: origin })),
      (error) => error.status === 403,
    );
  }
  assert.throws(
    () => assertSameOrigin(request()),
    (error) => error.status === 403,
  );
  assert.doesNotThrow(() =>
    assertSameOrigin(request({ Origin: "https://cafe.example" })),
  );
});

test("catalog payload cannot choose another owner and rejects invalid prices or duplicate IDs", () => {
  assert.throws(
    () => validateCatalog({ ...createSeedCatalog(), ownerId: "another-user" }),
    /Unexpected/,
  );
  const catalog = createSeedCatalog();
  catalog.items[0].price = 1.5;
  assert.throws(() => validateCatalog(catalog), /whole number/);
  catalog.items[0].price = -100;
  assert.throws(() => validateCatalog(catalog), /whole number/);
  catalog.items[0].price = 6800;
  catalog.items[1].id = catalog.items[0].id;
  assert.throws(() => validateCatalog(catalog), /unique ID/);
});

test("catalog validation preserves sample content and normalizes safe phone formatting", () => {
  const catalog = createSeedCatalog();
  catalog.settings.whatsapp = "+212 600-000-000";
  const output = validateCatalog(catalog);
  assert.deepEqual(output.items, catalog.items);
  assert.equal(output.settings.whatsapp, "212600000000");
  assert.equal(output.items[0].name.ar, catalog.items[0].name.ar);
});

test("URL validation blocks script protocols and bounds catalog size", () => {
  const catalog = createSeedCatalog();
  catalog.items[0].image = "javascript:alert(1)";
  assert.throws(() => validateCatalog(catalog), /HTTPS/);
  catalog.items[0].image = "/images/toast.jpg";
  catalog.settings.publicUrl = "javascript:alert(1)";
  assert.throws(() => validateCatalog(catalog), /HTTPS/);
  catalog.settings.publicUrl = "https://cafe.example/";
  catalog.items = Array.from({ length: 101 }, (_, i) => ({
    ...catalog.items[0],
    id: `item-${i}`,
  }));
  assert.throws(() => validateCatalog(catalog), /100 items/);
});

test("bounded JSON parser rejects large, malformed and non-JSON writes", async () => {
  await assert.rejects(
    readBoundedJson(request({ "Content-Length": "300000" })),
    (error) => error.status === 413,
  );
  await assert.rejects(
    readBoundedJson(request({}, JSON.stringify({ text: "a".repeat(100) })), 20),
    (error) => error.status === 413,
  );
  await assert.rejects(
    readBoundedJson(request({}, "{bad")),
    (error) => error.status === 400,
  );
  await assert.rejects(
    readBoundedJson(request({ "Content-Type": "text/plain" })),
    (error) => error.status === 415,
  );
  assert.deepEqual(await readBoundedJson(request({}, '{"revision":0}')), {
    revision: 0,
  });
});
