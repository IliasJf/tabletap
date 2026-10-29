// Loopback-only development adapter. Hosted production uses Sites auth + D1.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Readable } from "node:stream";
import { DatabaseSync } from "node:sqlite";
import { createSeedCatalog } from "../lib/menu-data.ts";
import {
  validateCatalog,
  upgradeStoredCatalog,
  CatalogValidationError,
} from "../lib/catalog-validation.ts";
import {
  ApiError,
  assertSameOrigin,
  readBoundedBytes,
  readBoundedJson,
} from "../lib/api-security.ts";
import {
  IMAGE_ID_PATTERN,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_OWNER,
  assertImage,
  base64ToBytes,
  bytesToBase64,
  imagePath,
  newImageId,
} from "../lib/images.ts";
import {
  MAX_ORDERS_PER_OWNER,
  OrderValidationError,
  buildOrderRecord,
  parseStatusChange,
  withStatus,
} from "../lib/orders.ts";

import {
  clearedSessionCookie,
  createSignInCode,
  endSession,
  getSessionUser,
  normalizeEmail,
  sendCodeWithResend,
  sessionCookie,
  verifySignInCode,
} from "../lib/auth.ts";
import { RATE_LIMIT_HIT_SQL, enforceLimit } from "../lib/rate-limit.ts";

/** Sign-in storage on node:sqlite, matching lib/auth-store.ts on D1. */
function sqliteAuthStore(db) {
  return {
    getCode: (email) =>
      db
        .prepare(
          "SELECT code_hash AS codeHash, expires_at AS expiresAt, attempts, created_at AS createdAt FROM login_codes WHERE email=?",
        )
        .get(email) ?? null,
    putCode: (email, code) =>
      db
        .prepare(
          "INSERT INTO login_codes(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=excluded.attempts, created_at=excluded.created_at",
        )
        .run(
          email,
          code.codeHash,
          code.expiresAt,
          code.attempts,
          code.createdAt,
        ),
    bumpAttempts: (email) =>
      db
        .prepare("UPDATE login_codes SET attempts=attempts+1 WHERE email=?")
        .run(email),
    deleteCode: (email) =>
      db.prepare("DELETE FROM login_codes WHERE email=?").run(email),
    findUserByEmail: (email) =>
      db.prepare("SELECT id, email FROM users WHERE email=?").get(email) ??
      null,
    createUser: (user, createdAt) =>
      db
        .prepare("INSERT INTO users(id,email,created_at) VALUES(?,?,?)")
        .run(user.id, user.email, createdAt),
    createSession: (session) =>
      db
        .prepare(
          "INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
        )
        .run(
          session.tokenHash,
          session.userId,
          session.expiresAt,
          session.createdAt,
        ),
    getSessionUser: (tokenHash, now) =>
      db
        .prepare(
          "SELECT users.id AS id, users.email AS email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?",
        )
        .get(tokenHash, now) ?? null,
    deleteSession: (tokenHash) =>
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash),
    deleteExpiredSessions: (userId, now) =>
      db
        .prepare("DELETE FROM sessions WHERE user_id=? AND expires_at<=?")
        .run(userId, now),
  };
}

const SLUG_TAKEN_MESSAGE =
  "That menu link name is already used by another restaurant. Choose another one.";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export async function createPreviewServer({
  databasePath = path.join(root, ".sites-runtime", "preview.sqlite"),
} = {}) {
  if (databasePath !== ":memory:")
    await mkdir(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  // Applies the same Drizzle migrations as production, tracked by user_version.
  const journal = JSON.parse(
    readFileSync(path.join(root, "drizzle", "meta", "_journal.json"), "utf8"),
  );
  const version = db.prepare("PRAGMA user_version").get().user_version;
  for (const entry of journal.entries.slice(version)) {
    const sql = readFileSync(
      path.join(root, "drizzle", `${entry.tag}.sql`),
      "utf8",
    );
    for (const statement of sql.split("--> statement-breakpoint"))
      if (statement.trim()) db.exec(statement);
    db.exec(`PRAGMA user_version=${entry.idx + 1}`);
  }
  const authStore = sqliteAuthStore(db);
  const limits = {
    hit: (key, windowStart) =>
      db.prepare(RATE_LIMIT_HIT_SQL).get(key, windowStart).count,
  };
  // Real email when Resend is configured; otherwise the code is shown on screen.
  const resend =
    process.env.RESEND_API_KEY && process.env.EMAIL_FROM
      ? { apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM }
      : null;
  function json(res, value, status = 200, headers = {}) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    });
    res.end(JSON.stringify(value));
  }
  const toCatalog = (row) => ({
    ...upgradeStoredCatalog(JSON.parse(row.payload)),
    revision: row.revision,
  });
  function read(owner) {
    const row = db
      .prepare(
        "SELECT payload, revision FROM restaurant_catalogs WHERE owner_id=?",
      )
      .get(owner);
    return row ? toCatalog(row) : null;
  }
  // Owner IDs win over link names, matching lib/catalog-store.ts.
  function readPublic(shop) {
    const row =
      db
        .prepare(
          "SELECT owner_id, payload, revision FROM restaurant_catalogs WHERE owner_id=?",
        )
        .get(shop) ??
      db
        .prepare(
          "SELECT owner_id, payload, revision FROM restaurant_catalogs WHERE slug=?",
        )
        .get(shop.toLowerCase());
    return row ? { ownerId: row.owner_id, catalog: toCatalog(row) } : null;
  }
  const webRequest = (req, url) =>
    new Request(url, {
      method: req.method,
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: "half",
    });
  const server = createServer(async (req, res) => {
    try {
      const expected = `127.0.0.1:${server.address().port}`;
      if (
        ![expected, `localhost:${server.address().port}`].includes(
          req.headers.host,
        )
      ) {
        res.writeHead(403);
        res.end("This preview only accepts loopback requests.");
        return;
      }
      const origin = `http://${req.headers.host}`,
        url = new URL(req.url, origin),
        user = await getSessionUser(authStore, req.headers.cookie ?? null),
        signed = Boolean(user),
        ip = req.socket.remoteAddress ?? "unknown";
      if (url.pathname.startsWith("/api/auth/")) {
        if (req.method !== "POST")
          throw new ApiError("Method not allowed.", 405);
        const request = webRequest(req, url);
        assertSameOrigin(request);
        if (url.pathname === "/api/auth/request-code") {
          await enforceLimit(limits, "codePerIp", ip);
          const body = await readBoundedJson(request, 1_000);
          await enforceLimit(
            limits,
            "codePerEmail",
            normalizeEmail(body?.email),
          );
          const { email, code } = await createSignInCode(authStore, body);
          if (!resend) {
            console.log(`Sign-in code for ${email}: ${code}`);
            json(res, { sent: true, devCode: code });
            return;
          }
          try {
            await sendCodeWithResend(resend, email, code);
          } catch (error) {
            authStore.deleteCode(email);
            throw error;
          }
          json(res, { sent: true });
          return;
        }
        if (url.pathname === "/api/auth/verify") {
          await enforceLimit(limits, "verifyPerIp", ip);
          const { user: signedIn, token } = await verifySignInCode(
            authStore,
            await readBoundedJson(request, 1_000),
          );
          json(
            res,
            {
              user: {
                id: signedIn.id,
                name: signedIn.email,
                email: signedIn.email,
              },
            },
            200,
            { "Set-Cookie": sessionCookie(token, false) },
          );
          return;
        }
        if (url.pathname === "/api/auth/signout") {
          await endSession(authStore, req.headers.cookie ?? null);
          json(res, { signedOut: true }, 200, {
            "Set-Cookie": clearedSessionCookie(false),
          });
          return;
        }
        throw new ApiError("Not found.", 404);
      }
      if (url.pathname === "/api/me") {
        json(res, {
          user: user
            ? { id: user.id, name: user.email, email: user.email }
            : null,
        });
        return;
      }
      if (url.pathname === "/api/catalog") {
        const shop = url.searchParams.get("shop");
        const catalog = shop ? readPublic(shop)?.catalog : createSeedCatalog();
        json(res, catalog || { error: "Menu not found." }, catalog ? 200 : 404);
        return;
      }
      const imageMatch = /^\/api\/images\/([^/]+)$/.exec(url.pathname);
      if (imageMatch) {
        const row = IMAGE_ID_PATTERN.test(imageMatch[1])
          ? db
              .prepare("SELECT data, content_type FROM menu_images WHERE id=?")
              .get(imageMatch[1])
          : null;
        if (!row) throw new ApiError("Photo not found.", 404);
        res.writeHead(200, {
          "Content-Type": row.content_type,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        });
        res.end(base64ToBytes(row.data));
        return;
      }
      if (url.pathname === "/api/orders") {
        if (req.method !== "POST")
          throw new ApiError("Method not allowed.", 405);
        const request = webRequest(req, url);
        assertSameOrigin(request);
        await enforceLimit(limits, "orderPerIp", ip);
        const body = await readBoundedJson(request, 20_000);
        const shop = body?.shop;
        if (typeof shop !== "string" || !shop || shop.length > 200)
          throw new ApiError("Invalid restaurant link.", 400);
        const found = readPublic(shop);
        if (!found)
          throw new ApiError("This restaurant menu was not found.", 404);
        const order = buildOrderRecord(body, found.catalog);
        db.prepare(
          "INSERT INTO orders(id,owner_id,created_at,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
        ).run(order.id, found.ownerId, order.createdAt, JSON.stringify(order));
        db.prepare(
          "DELETE FROM orders WHERE owner_id=? AND id NOT IN (SELECT id FROM orders WHERE owner_id=? ORDER BY created_at DESC LIMIT ?)",
        ).run(found.ownerId, found.ownerId, MAX_ORDERS_PER_OWNER);
        json(res, { id: order.id }, 201);
        return;
      }
      if (url.pathname === "/api/admin/orders") {
        if (!signed)
          throw new ApiError("Sign in to manage your restaurant menu.", 401);
        if (req.method === "PATCH") {
          const request = webRequest(req, url);
          assertSameOrigin(request);
          const { id, status } = parseStatusChange(
            await readBoundedJson(request, 1_000),
          );
          const row = db
            .prepare("SELECT payload FROM orders WHERE id=? AND owner_id=?")
            .get(id, user.id);
          if (!row) throw new ApiError("This order was not found.", 404);
          const next = {
            ...withStatus(JSON.parse(row.payload)),
            status,
            updatedAt: Date.now(),
          };
          db.prepare(
            "UPDATE orders SET payload=? WHERE id=? AND owner_id=?",
          ).run(JSON.stringify(next), id, user.id);
          json(res, next);
          return;
        }
        const rows = db
          .prepare(
            "SELECT payload FROM orders WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
          )
          .all(user.id);
        json(res, {
          orders: rows.map((row) => withStatus(JSON.parse(row.payload))),
        });
        return;
      }
      if (url.pathname === "/api/admin/images") {
        if (!signed)
          throw new ApiError("Sign in to manage your restaurant menu.", 401);
        if (req.method !== "POST")
          throw new ApiError("Method not allowed.", 405);
        const request = webRequest(req, url);
        assertSameOrigin(request);
        const bytes = await readBoundedBytes(request, MAX_IMAGE_BYTES);
        const contentType = assertImage(bytes);
        const { total } = db
          .prepare("SELECT count(*) AS total FROM menu_images WHERE owner_id=?")
          .get(user.id);
        if (total >= MAX_IMAGES_PER_OWNER)
          throw new ApiError(
            `You can store up to ${MAX_IMAGES_PER_OWNER} photos. Reuse an existing photo or contact support.`,
            400,
          );
        const id = newImageId();
        db.prepare(
          "INSERT INTO menu_images(id,owner_id,content_type,data,byte_length,created_at) VALUES(?,?,?,?,?,?)",
        ).run(
          id,
          user.id,
          contentType,
          bytesToBase64(bytes),
          bytes.byteLength,
          Date.now(),
        );
        json(res, { url: imagePath(id) }, 201);
        return;
      }
      if (url.pathname === "/api/admin/catalog") {
        if (!signed)
          throw new ApiError("Sign in to manage your restaurant menu.", 401);
        if (req.method === "GET") {
          json(res, read(user.id) || createSeedCatalog());
          return;
        }
        if (req.method !== "PUT")
          throw new ApiError("Method not allowed.", 405);
        const request = webRequest(req, url);
        assertSameOrigin(request);
        const catalog = validateCatalog(await readBoundedJson(request));
        const next = { ...catalog, revision: catalog.revision + 1 };
        const slug = next.settings.slug || null;
        if (
          slug &&
          db
            .prepare(
              "SELECT 1 FROM restaurant_catalogs WHERE slug=? AND owner_id<>?",
            )
            .get(slug, user.id)
        )
          throw new ApiError(SLUG_TAKEN_MESSAGE, 400);
        let changed;
        if (catalog.revision === 0)
          changed = db
            .prepare(
              "INSERT INTO restaurant_catalogs(owner_id,payload,revision,updated_at,slug) VALUES(?,?,?,?,?) ON CONFLICT(owner_id) DO NOTHING",
            )
            .run(
              user.id,
              JSON.stringify(next),
              next.revision,
              Date.now(),
              slug,
            );
        else
          changed = db
            .prepare(
              "UPDATE restaurant_catalogs SET payload=?,revision=?,updated_at=?,slug=? WHERE owner_id=? AND revision=?",
            )
            .run(
              JSON.stringify(next),
              next.revision,
              Date.now(),
              slug,
              user.id,
              catalog.revision,
            );
        if (!changed.changes)
          throw new ApiError(
            "This menu changed in another tab. Reload before saving.",
            409,
          );
        json(res, next);
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        json(res, { error: "Not found." }, 404);
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      let target;
      if (
        ["/", "/menu", "/admin", "/qr", "/credits", "/privacy"].includes(
          url.pathname,
        )
      )
        target = path.join(root, ".sites-runtime/preview/index.html");
      else if (["/app.js", "/app.css"].includes(url.pathname))
        target = path.join(
          root,
          ".sites-runtime/preview",
          url.pathname.slice(1),
        );
      else {
        const publicRoot = path.join(root, "public"),
          candidate = path.resolve(
            publicRoot,
            `.${decodeURIComponent(url.pathname)}`,
          );
        if (
          !candidate.startsWith(publicRoot + path.sep) ||
          !existsSync(candidate)
        ) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        target = candidate;
      }
      const bytes = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          contentTypes[path.extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      json(
        res,
        {
          error:
            error instanceof ApiError ||
            error instanceof CatalogValidationError ||
            error instanceof OrderValidationError
              ? error.message
              : "The preview could not complete the request.",
        },
        error instanceof ApiError
          ? error.status
          : error instanceof CatalogValidationError ||
              error instanceof OrderValidationError
            ? 400
            : 500,
      );
    }
  });
  server.on("close", () => db.close());
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = await createPreviewServer();
  server.listen(Number(process.env.PORT) || 5173, "127.0.0.1", () =>
    console.log(
      `TableTap local preview: http://127.0.0.1:${server.address().port}\nSign-in codes appear on screen unless RESEND_API_KEY and EMAIL_FROM are set. Press Ctrl+C to stop.`,
    ),
  );
}
