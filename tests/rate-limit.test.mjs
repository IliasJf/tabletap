import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createPreviewServer } from "../scripts/preview-server.mjs";
import { createSeedCatalog } from "../lib/menu-data.ts";
import { LIMITS, enforceLimit } from "../lib/rate-limit.ts";
import { signIn } from "./sign-in.mjs";

function memoryLimits() {
  const rows = new Map();
  return {
    rows,
    hit(key, windowStart) {
      const row = rows.get(key);
      const count = row && row.windowStart === windowStart ? row.count + 1 : 1;
      rows.set(key, { windowStart, count });
      return count;
    },
  };
}

test("limits block the request after the allowance and reset next window", async () => {
  const store = memoryLimits();
  const { limit, windowMs } = LIMITS.orderPerIp;
  const start = 10 * windowMs;
  for (let i = 0; i < limit; i++)
    await enforceLimit(store, "orderPerIp", "203.0.113.7", start);
  await assert.rejects(
    enforceLimit(store, "orderPerIp", "203.0.113.7", start),
    (error) => error.status === 429,
  );
  await enforceLimit(store, "orderPerIp", "198.51.100.2", start);
  await enforceLimit(store, "orderPerIp", "203.0.113.7", start + windowMs);
  assert.ok(
    ![...store.rows.keys()].some((key) => key.includes("203.0.113.7")),
    "only hashes of IP addresses are stored",
  );
});

test("local adapter rate-limits orders and sign-in codes", async () => {
  const server = await createPreviewServer({ databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const json = { origin, "content-type": "application/json" };
  try {
    const { cookie, userId } = await signIn(origin);
    await fetch(origin + "/api/admin/catalog", {
      method: "PUT",
      headers: { ...json, cookie },
      body: JSON.stringify(createSeedCatalog()),
    });
    const order = (i) =>
      fetch(origin + "/api/orders", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: i.toString(16).padStart(32, "0"),
          shop: userId,
          cart: [{ itemId: "flat-white", optionIds: [], quantity: 1 }],
          details: {
            name: "Test",
            type: "takeaway",
            table: "",
            address: "",
            notes: "",
          },
        }),
      });
    const statuses = [];
    for (let i = 1; i <= LIMITS.orderPerIp.limit + 1; i++)
      statuses.push((await order(i)).status);
    assert.equal(
      statuses.filter((s) => s === 201).length,
      LIMITS.orderPerIp.limit,
    );
    assert.equal(statuses.at(-1), 429);

    // Each code needs a minute's wait, so count rejections instead of waiting.
    const request = () =>
      fetch(origin + "/api/auth/request-code", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ email: "spam-target@cafe.test" }),
      });
    const codeStatuses = [];
    for (let i = 0; i < LIMITS.codePerEmail.limit + 1; i++)
      codeStatuses.push((await request()).status);
    assert.equal(codeStatuses[0], 200);
    assert.equal(codeStatuses.at(-1), 429);
    assert.match(
      (await (await request()).json()).error,
      /today/,
      "the daily email cap applies once reached",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
