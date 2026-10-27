import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createPreviewServer } from "../scripts/preview-server.mjs";
import { createSeedCatalog } from "../lib/menu-data.ts";
import {
  CODE_TTL_MS,
  createSignInCode,
  generateCode,
  normalizeEmail,
  readSessionToken,
  verifySignInCode,
} from "../lib/auth.ts";
import { signIn } from "./sign-in.mjs";

/** In-memory AuthStore for testing the flow without a database. */
function memoryStore() {
  const codes = new Map(),
    users = new Map(),
    sessions = new Map();
  return {
    codes,
    sessions,
    getCode: (email) => codes.get(email) ?? null,
    putCode: (email, code) => void codes.set(email, { ...code }),
    bumpAttempts: (email) => void codes.get(email).attempts++,
    deleteCode: (email) => void codes.delete(email),
    findUserByEmail: (email) => users.get(email) ?? null,
    createUser: (user) => void users.set(user.email, user),
    createSession: (s) => void sessions.set(s.tokenHash, s),
    getSessionUser: (hash, now) => {
      const s = sessions.get(hash);
      if (!s || s.expiresAt <= now) return null;
      return [...users.values()].find((u) => u.id === s.userId) ?? null;
    },
    deleteSession: (hash) => void sessions.delete(hash),
    deleteExpiredSessions: () => {},
  };
}

test("codes are six random digits and emails are normalized", () => {
  const seen = new Set(Array.from({ length: 200 }, generateCode));
  for (const code of seen) assert.match(code, /^\d{6}$/);
  assert.ok(seen.size > 190, "codes should not repeat often");
  assert.equal(normalizeEmail("  Owner@Cafe.MA "), "owner@cafe.ma");
  for (const bad of ["", "owner", "owner@", "a b@cafe.ma", "x@y"])
    assert.throws(() => normalizeEmail(bad), /valid email/);
});

test("codes are single-use, expire, rate-limited and locked after 5 wrong tries", async () => {
  const store = memoryStore();
  const { email, code } = await createSignInCode(
    store,
    {
      email: "Owner@Cafe.ma",
    },
    1000,
  );
  assert.equal(email, "owner@cafe.ma");
  assert.ok(
    !JSON.stringify([...store.codes]).includes(code),
    "only a hash is stored",
  );
  await assert.rejects(
    createSignInCode(store, { email }, 30_000),
    (error) => error.status === 429,
  );
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      verifySignInCode(store, { email, code: wrong }, { now: 2000 }),
      /isn't right/,
    );
  await assert.rejects(
    verifySignInCode(store, { email, code }, { now: 2000 }),
    (error) => error.status === 429,
    "the right code no longer works after 5 wrong tries",
  );

  const fresh = await createSignInCode(store, { email }, 100_000);
  await assert.rejects(
    verifySignInCode(
      store,
      { email, code: fresh.code },
      {
        now: 100_000 + CODE_TTL_MS,
      },
    ),
    /expired/,
  );

  const again = await createSignInCode(store, { email }, 200_000);
  const { user, token } = await verifySignInCode(
    store,
    { email, code: again.code },
    { now: 200_000 },
  );
  assert.match(user.id, /^u_[a-f0-9]{32}$/);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.ok(!store.sessions.has(token), "only a hash of the token is stored");
  await assert.rejects(
    verifySignInCode(store, { email, code: again.code }, { now: 200_001 }),
    /expired/,
    "a used code can't be reused",
  );
});

test("an existing owner can keep their old ID on first email sign-in", async () => {
  const store = memoryStore();
  const { email, code } = await createSignInCode(store, {
    email: "owner@cafe.ma",
  });
  const { user } = await verifySignInCode(
    store,
    { email, code },
    {
      preferredUserId: "chatgpt-user-123",
    },
  );
  assert.equal(user.id, "chatgpt-user-123");
});

test("session cookies are read strictly", () => {
  const token = "a".repeat(64);
  assert.equal(readSessionToken(`x=1; tabletap_session=${token}`), token);
  assert.equal(readSessionToken("tabletap_session=../../etc"), null);
  assert.equal(readSessionToken(null), null);
});

test("local adapter: sign-in, separate owners, and sign-out", async () => {
  const server = await createPreviewServer({ databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(
      (
        await fetch(origin + "/api/auth/request-code", {
          method: "POST",
          headers: {
            origin: "https://attacker.example",
            "content-type": "application/json",
          },
          body: JSON.stringify({ email: "owner@cafe.test" }),
        })
      ).status,
      403,
      "codes can't be requested from another site",
    );

    const amina = await signIn(origin, "amina@cafe.test");
    const karim = await signIn(origin, "karim@cafe.test");
    assert.notEqual(amina.userId, karim.userId);
    const again = await signIn(origin, "AMINA@cafe.test");
    assert.equal(again.userId, amina.userId, "same email, same account");

    const put = (cookie, catalog) =>
      fetch(origin + "/api/admin/catalog", {
        method: "PUT",
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify(catalog),
      });
    const mine = createSeedCatalog();
    mine.settings.name = "Chez Amina";
    assert.equal((await put(amina.cookie, mine)).status, 200);
    const karimView = await (
      await fetch(origin + "/api/admin/catalog", {
        headers: { cookie: karim.cookie },
      })
    ).json();
    assert.notEqual(karimView.settings.name, "Chez Amina");

    const me = () =>
      fetch(origin + "/api/me", { headers: { cookie: amina.cookie } }).then(
        (r) => r.json(),
      );
    assert.equal((await me()).user.email, "amina@cafe.test");
    await fetch(origin + "/api/auth/signout", {
      method: "POST",
      headers: { cookie: amina.cookie, origin },
    });
    assert.equal((await me()).user, null, "signed-out cookies stop working");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
