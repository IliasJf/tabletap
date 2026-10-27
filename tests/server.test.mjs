import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createPreviewServer } from "../scripts/preview-server.mjs";
import { createSeedCatalog } from "../lib/menu-data.ts";
import { signIn } from "./sign-in.mjs";

test("local full-stack adapter enforces sessions, validates writes, persists menus and rejects stale saves", async () => {
  const server = await createPreviewServer({ databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(origin + "/api/admin/catalog")).status, 401);
    const spoof = await fetch(origin + "/api/admin/catalog", {
      headers: { "oai-authenticated-user-id": "u_spoofed" },
    });
    assert.equal(
      spoof.status,
      401,
      "local adapter must ignore spoofed identity headers",
    );
    const { cookie, userId } = await signIn(origin);
    const catalog = createSeedCatalog();
    catalog.settings.name = "Integration Café";
    const put = (value, originHeader = origin) =>
      fetch(origin + "/api/admin/catalog", {
        method: "PUT",
        headers: {
          cookie,
          origin: originHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify(value),
      });
    assert.equal((await put(catalog, "https://foreign.example")).status, 403);
    assert.equal(
      (await put({ ...catalog, items: [{ ...catalog.items[0], price: -1 }] }))
        .status,
      400,
    );
    const saved = await put(catalog);
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).revision, 1);
    assert.equal(
      (await put(catalog)).status,
      409,
      "stale revision cannot overwrite saved data",
    );
    const publicMenu = await fetch(origin + `/api/catalog?shop=${userId}`);
    assert.equal(publicMenu.status, 200);
    const published = await publicMenu.json();
    assert.equal(published.settings.name, "Integration Café");
    assert.equal(published.revision, 1);
    assert.equal(
      (await fetch(origin + "/api/catalog?shop=unknown")).status,
      404,
    );
    const session = await fetch(origin + "/api/me", { headers: { cookie } });
    assert.equal((await session.json()).user.id, userId);
    const logout = await fetch(origin + "/api/auth/signout", {
      method: "POST",
      headers: { cookie, origin },
    });
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
